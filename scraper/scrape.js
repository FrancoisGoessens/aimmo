// scrape.js
// Tourne dans GitHub Actions (voir .github/workflows/scrape-and-deploy.yml), planifié
// lundi/mercredi, ou déclenché à la demande depuis le site (bouton "Générer un
// bulletin"). Lit frontend/public/criteria-<market>.json + communes-temps.json, va
// chercher les annonces, les score, et écrit un bulletin JSON par marché dans
// frontend/public/data/bulletins/<market>/.
//
// Variables d'environnement optionnelles (posées par un déclenchement manuel) :
//   RUN_MARKET        "achat" | "location" | "both" (défaut : "both")
//   RUN_SOURCE        "auto" | "manual" (défaut : "auto")
//   BUDGET_OVERRIDE_<MARKET>   surcharge ponctuelle du budget max, ne modifie pas le
//                              fichier criteria-<market>.json
//
// IMPORTANT : les sélecteurs CSS et les URLs de recherche ci-dessous sont une base de
// départ raisonnable pour PAP.fr, mais je n'ai pas pu les tester en live (pas d'accès web
// à ce site depuis mon environnement). Il faudra très probablement les ajuster au premier
// vrai run — voir parseListingCard() plus bas. Idem pour communes-temps.json : le fichier
// livré contient des estimations manuelles, lance `npm run compute-communes` pour le
// remplacer par de vrais temps de trajet calculés via OSRM.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import fetch from "node-fetch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "frontend", "public");
const MOCK = process.argv.includes("--mock");
const MAX_TOP = 10;
const MAX_BULLETINS_KEPT = 60; // ~7 mois d'historique à raison de 2/semaine

const RUN_MARKET = process.env.RUN_MARKET || "both";
const RUN_SOURCE = process.env.RUN_SOURCE === "manual" ? "manual" : "auto";

function slugify(city) {
  return city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function loadCriteria(market) {
  const raw = await fs.readFile(path.join(PUBLIC_DIR, `criteria-${market}.json`), "utf-8");
  const criteria = JSON.parse(raw);
  const overrideKey = `BUDGET_OVERRIDE_${market.toUpperCase()}`;
  if (process.env[overrideKey]) {
    criteria.budgetMax = Number(process.env[overrideKey]);
  }
  return criteria;
}

async function loadZones(criteria) {
  try {
    const raw = await fs.readFile(path.join(PUBLIC_DIR, "data", "communes-temps.json"), "utf-8");
    const data = JSON.parse(raw);
    return (data.communes || [])
      .filter((c) => c.minutes >= criteria.zonesMinMinutes && c.minutes <= criteria.zonesMaxMinutes)
      .map((c) => c.name);
  } catch {
    return [];
  }
}

function buildSearchUrls(market, cities) {
  const type = market === "achat" ? "vente" : "location";
  const urls = [];
  for (const kind of ["maison", "appartement"]) {
    for (const city of cities) {
      const slug = slugify(city);
      urls.push({ url: `https://www.pap.fr/annonce/${type}-${kind}-${slug}-g`, kind, city });
    }
  }
  return urls;
}

function parseListingCard($, el, kind, city) {
  const card = $(el);
  const title = card.find(".item-title, h3, .item-name").first().text().trim();
  const priceText = card.find(".item-price, .price").first().text().trim();
  const link = card.find("a").first().attr("href");
  const surfaceText = card.text().match(/(\d+)\s?m²/)?.[1];
  const etageText = card.text().match(/(\d+)(?:er|ème|e)\s?étage/i)?.[1];
  const price = priceText ? Number(priceText.replace(/[^\d]/g, "")) : null;
  const surface = surfaceText ? Number(surfaceText) : null;
  const etage = kind === "maison" ? null : etageText ? Number(etageText) : /rez.de.chauss/i.test(title) ? 0 : null;

  if (!title || !price) return null;

  return {
    type: kind,
    city,
    title,
    price,
    surface,
    etage,
    jardin: /jardin/i.test(card.text()),
    parking: /(parking|garage|box)/i.test(card.text()),
    dpe: card.text().match(/DPE\s?:?\s?([A-G])/i)?.[1] ?? null,
    link: link?.startsWith("http") ? link : `https://www.pap.fr${link ?? ""}`,
  };
}

async function fetchListings(url, kind, city) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (!res.ok) {
    console.warn(`  ⚠️  ${url} → HTTP ${res.status}`);
    return [];
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  return $(".item, .search-list-item, article")
    .toArray()
    .map((el) => parseListingCard($, el, kind, city))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Scoring 0-10 selon les critères du marché. Pas éliminatoire (une annonce
// un peu en dessous des critères peut apparaître avec un score bas plutôt
// que disparaître complètement).
// ---------------------------------------------------------------------------
const DPE_ORDER = ["A", "B", "C", "D", "E", "F", "G"];

function scoreListing(listing, market, criteria) {
  let score = 5;

  if (listing.surface) {
    score += Math.max(-2, Math.min(2, (listing.surface - criteria.surfaceMin) / 20));
  }

  if (listing.price) {
    if (listing.price > criteria.budgetMax) {
      score -= Math.min(3, ((listing.price - criteria.budgetMax) / criteria.budgetMax) * 5);
    } else {
      score += 0.5;
    }
  }

  if (criteria.jardin) score += listing.jardin ? 1 : -0.5;
  if (criteria.parking) score += listing.parking ? 1 : -0.5;

  if (listing.dpe) {
    const dist = DPE_ORDER.indexOf(listing.dpe) - DPE_ORDER.indexOf(criteria.dpeMin);
    score += dist <= 0 ? 1 : -dist * 0.5;
  }

  if (market === "location" && typeof criteria.etageMax === "number" && listing.etage !== null) {
    if (listing.etage > criteria.etageMax) score -= 1.5;
  } else if (market === "achat" && /rdc|1er/i.test(String(criteria.etageMax)) && listing.etage !== null) {
    if (listing.etage > 1) score -= 1.5;
  }

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

// ---------------------------------------------------------------------------
function mockListings(market) {
  const villes = ["Boulogne-sur-Mer", "Wimereux", "Outreau", "Le Portel", "Saint-Martin-Boulogne"];
  const isAchat = market === "achat";
  return Array.from({ length: 18 }).map((_, i) => {
    const type = i % 3 === 0 ? "appartement" : "maison";
    const surface = 40 + Math.round(Math.random() * 90);
    const priceBase = isAchat ? 1900 + Math.random() * 900 : 8 + Math.random() * 6;
    const price = Math.round(surface * priceBase);
    return {
      type,
      city: villes[i % villes.length],
      title: `${type === "maison" ? "Maison" : "Appartement"} ${surface}m² - ${villes[i % villes.length]}`,
      price,
      surface,
      etage: type === "maison" ? null : i % 4,
      jardin: i % 2 === 0,
      parking: i % 3 !== 0,
      dpe: "ABCDEFG"[i % 7],
      link: "https://www.pap.fr/annonce/exemple-" + market + "-" + i,
    };
  });
}

// ---------------------------------------------------------------------------
async function runForMarket(market) {
  console.log(`\n📍 Marché : ${market} (source=${RUN_SOURCE})`);
  const criteria = await loadCriteria(market);
  const zones = await loadZones(criteria);
  console.log(`  Zones résolues (${criteria.zonesMinMinutes}-${criteria.zonesMaxMinutes} min) : ${zones.join(", ") || "(aucune)"}`);

  let listings = [];
  if (MOCK) {
    listings = mockListings(market);
    console.log(`  (mode --mock : ${listings.length} annonces factices générées)`);
  } else if (zones.length === 0) {
    console.warn("  ⚠️  Aucune commune dans l'intervalle choisi — vérifie communes-temps.json et les critères.");
  } else {
    for (const { url, kind, city } of buildSearchUrls(market, zones)) {
      console.log(`  → ${url}`);
      listings.push(...(await fetchListings(url, kind, city)));
      await new Promise((r) => setTimeout(r, 1500));
    }
    console.log(`  ${listings.length} annonces brutes récupérées.`);
  }

  const scored = listings
    .map((l, i) => ({ ...l, score: scoreListing(l, market, criteria), id: `${market}-${Date.now()}-${i}` }))
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
    avgPricePerM2,
    avgPrice,
    totalAnalyzed: scored.length,
    bestScore: top10.length ? top10[0].score : 0,
    top10,
  };

  const outDir = path.join(PUBLIC_DIR, "data", "bulletins", market);
  await fs.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${stamp}.json`;
  await fs.writeFile(path.join(outDir, filename), JSON.stringify(bulletin, null, 2));
  console.log(`  ✅ Écrit ${market}/${filename} (${top10.length} annonces retenues sur ${scored.length} analysées)`);

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
  for (const market of markets) {
    await runForMarket(market);
  }
  console.log("\n🏁 Terminé.");
}

main().catch((err) => {
  console.error("❌ Erreur pendant le scraping :", err);
  process.exit(1);
});
