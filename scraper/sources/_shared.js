// _shared.js — utilitaires communs aux adaptateurs "agences" (pas.js, orpi.js,
// guy-hoquet.js...). Chaque adaptateur reste responsable de son URL et de son parsing
// (le HTML diffère par site), mais partage la logique de fetch/normalisation.

import fetch from "node-fetch";

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export function slugify(city) {
  return city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    console.warn(`    ⚠️  ${url} → HTTP ${res.status}`);
    return null;
  }
  return res.text();
}

// Pause entre requêtes pour rester correct vis-à-vis des sites ciblés.
export function wait(ms = 1500) {
  return new Promise((r) => setTimeout(r, ms));
}

// Table de codes postaux partagée par les adaptateurs qui en ont besoin (FNAIM,
// Square Habitat, Foncia). Complète-la si tu ajoutes des communes candidates dans
// compute-communes.js.
export const POSTAL_CODES = {
  "boulogne-sur-mer": "62200",
  wimereux: "62930",
  outreau: "62230",
  "le portel": "62480",
  "saint-martin-boulogne": "62280",
  wimille: "62126",
  marquise: "62250",
  desvres: "62240",
  condette: "62360",
  samer: "62830",
  "hardelot-plage": "62152",
  offrethun: "62142",
  wacquinghen: "62250",
  baincthun: "62360",
  echinghen: "62360",
  "saint-léonard": "62360",
  isques: "62360",
  "saint-étienne-au-mont": "62360",
  "pont-de-briques": "62360",
};
