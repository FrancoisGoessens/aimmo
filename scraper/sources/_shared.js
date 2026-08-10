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
