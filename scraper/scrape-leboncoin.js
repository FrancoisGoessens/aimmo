// scrape-leboncoin.js — scraper Leboncoin, séparé de scrape.js volontairement (source
// plus fragile côté anti-bot, jamais mélangée aux autres sites). Tourne uniquement à
// la demande, ou 1x/semaine si activé dans frontend/public/leboncoin-config.json.
// Réutilise les critères de filtre (budget, surface, zones, DPE...) des mêmes
// criteria-<market>.json que le scraper agences, mais écrit dans un arbre de données
// totalement séparé : frontend/public/data/bulletins/leboncoin/<market>/.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as leboncoin from "./sources/leboncoin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "frontend", "public");
const MOCK = process.argv.includes("--mock");
const MAX_TOP = 10;
const MAX_BULLETINS_KEPT = 60;

const RUN_MARKET = process.env.RUN_MARKET || "both";
const RUN_SOURCE = process.env.RUN_SOURCE === "manual" ? "manual" : "auto";

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
    return (data.communes || [])
      .filter((c) => c.minutes >= criteria.zonesMinMinutes && c.minutes <= criteria.zonesMaxMinutes)
      .map((c) => c.name);
  } catch {
    return [];
  }
}

async function loadLeboncoinConfig() {
  try {
    const raw = await fs.readFile(path.join(PUBLIC_DIR, "leboncoin-config.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return { achat: { enabled: false, autoWeekly: false }, location: { enabled: false, autoWeekly: false } };
  }
}

const DPE_ORDER = ["A", "B", "C", "D", "E", "F", "G"];

function scoreListing(listing, market, criteria) {
  let score = 5;
  if (listing.surface) score += Math.max(-2, Math.min(2, (listing.surface - criteria.surfaceMin) / 20));
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

function mockListings(market) {
  const villes = ["Boulogne-sur-Mer", "Wimereux", "Outreau"];
  const isAchat = market === "achat";
  return Array.from({ length: 12 }).map((_, i) => {
    const type = i % 3 === 0 ? "appartement" : "maison";
    const surface = 40 + Math.round(Math.random() * 90);
    const priceBase = isAchat ? 1900 + Math.random() * 900 : 8 + Math.random() * 6;
    const price = Math.round(surface * priceBase);
    return {
      source: "leboncoin",
      type,
      city: villes[i % villes.length],
      title: `${type === "maison" ? "Maison" : "Appartement"} ${surface}m² - ${villes[i % villes.length]}`,
      price,
      surface,
      etage: type === "maison" ? null : i % 4,
      jardin: i % 2 === 0,
      parking: i % 3 !== 0,
      dpe: "ABCDEFG"[i % 7],
      link: `https://leboncoin.fr/exemple-${market}-${i}`,
    };
  });
}

async function runForMarket(market) {
  const config = await loadLeboncoinConfig();
  if (!config[market]?.enabled) {
    console.log(`\n📍 Marché : ${market} — Leboncoin désactivé dans leboncoin-config.json, on saute.`);
    return;
  }

  console.log(`\n📍 Marché : ${market} (source=${RUN_SOURCE})`);
  const criteria = await loadCriteria(market);
  const zones = await loadZones(criteria);
  console.log(`  Zones résolues : ${zones.join(", ") || "(aucune)"}`);

  let listings = [];
  let flaggedCount = 0;

  if (MOCK) {
    listings = mockListings(market);
    console.log(`  (mode --mock : ${listings.length} annonces factices générées)`);
  } else if (zones.length === 0) {
    console.warn("  ⚠️  Aucune zone dans l'intervalle choisi.");
  } else {
    const result = await leboncoin.search(market, zones);
    listings = result.listings;
    flaggedCount = result.flaggedCount;
    console.log(`  ${listings.length} annonces retenues, ${flaggedCount} écartée(s) comme suspectes.`);
  }

  const scored = listings
    .map((l, i) => ({ ...l, score: scoreListing(l, market, criteria), id: `${market}-${Date.now()}-${i}` }))
    .map((l) => ({ ...l, pricePerM2: l.surface ? Math.round(l.price / l.surface) : null }));

  const withPm2 = scored.filter((l) => l.pricePerM2);
  const avgPricePerM2 = withPm2.length
    ? Math.round(withPm2.reduce((sum, l) => sum + l.pricePerM2, 0) / withPm2.length)
    : 0;
  const avgPrice = scored.length ? Math.round(scored.reduce((sum, l) => sum + l.price, 0) / scored.length) : 0;
  const top10 = scored.sort((a, b) => b.score - a.score).slice(0, 10);

  const bulletin = {
    id: `${market}-${Date.now()}`,
    market,
    date: new Date().toISOString(),
    source: RUN_SOURCE,
    flaggedCount,
    avgPricePerM2,
    avgPrice,
    totalAnalyzed: scored.length,
    bestScore: top10.length ? top10[0].score : 0,
    top10,
  };

  const outDir = path.join(PUBLIC_DIR, "data", "bulletins", "leboncoin", market);
  await fs.mkdir(outDir, { recursive: true });
  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await fs.writeFile(path.join(outDir, filename), JSON.stringify(bulletin, null, 2));
  console.log(`  ✅ Écrit leboncoin/${market}/${filename}`);

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
  console.error("❌ Erreur pendant le scraping Leboncoin :", err);
  process.exit(1);
});
