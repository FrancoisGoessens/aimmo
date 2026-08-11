// scrape.js — scraper "agences" (PAP, Orpi, Guy Hoquet — pas Leboncoin, voir
// scrape-leboncoin.js). Tourne dans GitHub Actions, planifié lundi/mercredi, ou
// déclenché à la demande. Lit frontend/public/criteria-<market>.json (dont le champ
// `sources`, coché depuis Paramètres), n'interroge que les sites activés, merge et
// score, écrit un bulletin JSON par marché dans
// frontend/public/data/bulletins/agences/<market>/.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as orpi from "./sources/orpi.js";
import * as fnaim from "./sources/fnaim.js";
import * as squareHabitat from "./sources/square-habitat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "frontend", "public");
const MOCK = process.argv.includes("--mock");
const MAX_TOP = 10;
const MAX_BULLETINS_KEPT = 60;

const RUN_MARKET = process.env.RUN_MARKET || "both";
const RUN_SOURCE = process.env.RUN_SOURCE === "manual" ? "manual" : "auto";

const ADAPTERS = { [orpi.id]: orpi, [fnaim.id]: fnaim, [squareHabitat.id]: squareHabitat };

async function loadCriteria(market) {
  const raw = await fs.readFile(path.join(PUBLIC_DIR, `criteria-${market}.json`), "utf-8");
  const criteria = JSON.parse(raw);
  const overrideKey = `BUDGET_OVERRIDE_${market.toUpperCase()}`;
  if (process.env[overrideKey]) criteria.budgetMax = Number(process.env[overrideKey]);
  return criteria;
}

async function loadZones(criteria) {
  try {
    const raw = await fs.readFile(path.join(PUBLIC_DIR, "data", "communes-temps.json"), "utf-8");
    const data = JSON.parse(raw);
    const inRange = (data.communes || []).filter(
      (c) => c.minutes >= criteria.zonesMinMinutes && c.minutes <= criteria.zonesMaxMinutes
    );
    const minutesByCity = new Map((data.communes || []).map((c) => [c.name, c.minutes]));
    return { names: inRange.map((c) => c.name), minutesByCity };
  } catch {
    return { names: [], minutesByCity: new Map() };
  }
}

// ---------------------------------------------------------------------------
// Scoring par points, un point par critère rempli + bonus quand le bien dépasse
// nettement le critère. Jardin/parking sont toujours un bonus s'ils sont présents,
// jamais une pénalité s'ils sont absents (même si demandés) — on ne dit pas non à
// un plus, mais on ne punit pas leur absence sur un critère non-obligatoire.
// Score final sur une échelle d'environ 0 à 10 (10 = tous les points + tous les bonus).
// ---------------------------------------------------------------------------
function normalizeCity(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const DPE_ORDER = ["A", "B", "C", "D", "E", "F", "G"];

function scoreListing(listing, market, criteria, cityMinutes) {
  let score = 0;

  // Zone (temps de trajet) — normalement toujours vrai puisqu'on ne recherche que
  // dans les villes déjà dans l'intervalle, mais on vérifie quand même (au cas où
  // la donnée de trajet manque pour cette ville).
  if (cityMinutes !== undefined && cityMinutes >= criteria.zonesMinMinutes && cityMinutes <= criteria.zonesMaxMinutes) {
    score += 1;
  }

  // Budget : 1 point si dans le budget, +1 bonus si nettement moins cher (15% sous le max)
  if (listing.price !== null && listing.price !== undefined) {
    if (listing.price <= criteria.budgetMax) {
      score += 1;
      if (listing.price <= criteria.budgetMax * 0.85) score += 1;
    }
  }

  // Surface : 1 point si >= minimum, +1 bonus si nettement au-dessus (+20m²)
  if (listing.surface !== null) {
    if (listing.surface >= criteria.surfaceMin) {
      score += 1;
      if (listing.surface >= criteria.surfaceMin + 20) score += 1;
    }
  }

  // Étage : 1 point si respecte la contrainte, +1 bonus si RDC pile
  const etageMaxNum =
    typeof criteria.etageMax === "number" ? criteria.etageMax : /rdc|1er/i.test(String(criteria.etageMax)) ? 1 : null;
  if (listing.etage !== null && etageMaxNum !== null) {
    if (listing.etage <= etageMaxNum) {
      score += 1;
      if (listing.etage === 0) score += 1;
    }
  }
  // Maison ou info d'étage absente : ni pénalité ni bonus, on ne sait juste pas.

  // DPE : 1 point si au moins aussi bon que le minimum demandé
  if (listing.dpe) {
    const dist = DPE_ORDER.indexOf(listing.dpe) - DPE_ORDER.indexOf(criteria.dpeMin);
    if (dist <= 0) score += 1;
  }

  // Jardin / parking : toujours un bonus s'ils sont là, jamais de pénalité sinon
  if (listing.jardin) score += 1;
  if (listing.parking) score += 1;

  return Math.round(score * 10) / 10;
}

function mockListings(market, sourceId) {
  const villes = ["Boulogne-sur-Mer", "Wimereux", "Outreau", "Le Portel", "Saint-Martin-Boulogne"];
  const isAchat = market === "achat";
  return Array.from({ length: 8 }).map((_, i) => {
    const type = i % 3 === 0 ? "appartement" : "maison";
    const surface = 40 + Math.round(Math.random() * 90);
    const priceBase = isAchat ? 1900 + Math.random() * 900 : 8 + Math.random() * 6;
    const price = Math.round(surface * priceBase);
    return {
      source: sourceId,
      type,
      city: villes[i % villes.length],
      title: `${type === "maison" ? "Maison" : "Appartement"} ${surface}m² - ${villes[i % villes.length]}`,
      price,
      surface,
      etage: type === "maison" ? null : i % 4,
      jardin: i % 2 === 0,
      parking: i % 3 !== 0,
      dpe: "ABCDEFG"[i % 7],
      link: `https://example.com/${sourceId}-${market}-${i}`,
    };
  });
}

async function runForMarket(market) {
  console.log(`\n📍 Marché : ${market} (source=${RUN_SOURCE})`);
  const criteria = await loadCriteria(market);
  const { names: zones, minutesByCity } = await loadZones(criteria);
  const enabledSources = (criteria.sources || []).filter((s) => ADAPTERS[s]);
  console.log(`  Sites activés : ${enabledSources.join(", ") || "(aucun)"}`);
  console.log(`  Zones résolues (${criteria.zonesMinMinutes}-${criteria.zonesMaxMinutes} min) : ${zones.join(", ") || "(aucune)"}`);

  let listings = [];
  if (MOCK) {
    enabledSources.forEach((s) => listings.push(...mockListings(market, s)));
    console.log(`  (mode --mock : ${listings.length} annonces factices générées)`);
  } else if (zones.length === 0 || enabledSources.length === 0) {
    console.warn("  ⚠️  Aucune zone ou aucun site activé — vérifie criteria et communes-temps.json.");
  } else {
    for (const sourceId of enabledSources) {
      console.log(`  🔎 Source : ${ADAPTERS[sourceId].label}`);
      try {
        const found = await ADAPTERS[sourceId].search(market, zones);
        console.log(`    ${found.length} annonces trouvées.`);
        listings.push(...found);
      } catch (err) {
        console.warn(`    ⚠️  Source ${ADAPTERS[sourceId].label} en erreur, ignorée : ${err.message}`);
      }
    }
  }

  const zoneSet = new Set(zones.map(normalizeCity));

  const scored = listings
    .filter((l) => zoneSet.has(normalizeCity(l.city))) // exclut le "bruit" hors-zone (ex: fallback Orpi vers le département quand une ville a 0 résultat)
    .filter((l, i, arr) => arr.findIndex((x) => x.link === l.link) === i) // dédoublonnage par lien
    .map((l, i) => ({
      ...l,
      score: scoreListing(l, market, criteria, minutesByCity.get(l.city)),
      id: `${market}-${Date.now()}-${i}`,
    }))
    .map((l) => ({ ...l, pricePerM2: l.surface ? Math.round(l.price / l.surface) : null }));

  const withPm2 = scored.filter((l) => l.pricePerM2);
  const avgPricePerM2 = withPm2.length
    ? Math.round(withPm2.reduce((sum, l) => sum + l.pricePerM2, 0) / withPm2.length)
    : 0;
  const avgPrice = scored.length ? Math.round(scored.reduce((sum, l) => sum + l.price, 0) / scored.length) : 0;
  const top10 = scored.sort((a, b) => b.score - a.score).slice(0, MAX_TOP);

  const bulletin = {
    id: `${market}-${Date.now()}`,
    market,
    date: new Date().toISOString(),
    source: RUN_SOURCE,
    sourcesUsed: enabledSources,
    avgPricePerM2,
    avgPrice,
    totalAnalyzed: scored.length,
    bestScore: top10.length ? top10[0].score : 0,
    top10,
  };

  const outDir = path.join(PUBLIC_DIR, "data", "bulletins", "agences", market);
  await fs.mkdir(outDir, { recursive: true });
  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await fs.writeFile(path.join(outDir, filename), JSON.stringify(bulletin, null, 2));
  console.log(`  ✅ Écrit agences/${market}/${filename} (${top10.length} retenues sur ${scored.length} analysées)`);

  const indexPath = path.join(outDir, "index.json");
  let index = [];
  try {
    index = JSON.parse(await fs.readFile(indexPath, "utf-8"));
  } catch {
    // pas encore de fichier index
  }
  index = [...new Set([...index, filename])].sort().slice(-MAX_BULLETINS_KEPT);
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
}

async function main() {
  const markets = RUN_MARKET === "both" ? ["achat", "location"] : [RUN_MARKET];
  for (const market of markets) await runForMarket(market);
  console.log("\n🏁 Terminé.");
}

main().catch((err) => {
  console.error("❌ Erreur pendant le scraping :", err);
  process.exit(1);
});
