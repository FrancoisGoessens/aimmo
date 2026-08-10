// square-habitat.js — adaptateur Square Habitat (réseau Crédit Agricole).
//
// URL confirmée le 10/08 : voir plus bas. Contrairement aux autres sources, les
// annonces ne sont PAS dans des cards HTML classiques mais dans un bloc
// <script type="application/ld+json"> (structured data schema.org). Confirmé par un
// vrai extrait fourni le 10/08.
//
// LIMITE IMPORTANTE, à avoir en tête : ce JSON-LD ne contient que le nom du bien et
// son prix — PAS de lien direct vers l'annonce individuelle, PAS de surface, PAS de
// DPE, PAS de jardin/parking. Conséquences concrètes :
//   - Le lien "Voir l'annonce" pour un résultat Square Habitat renvoie vers la page
//     de recherche générale, pas vers le bien précis (le site ne l'expose pas ici).
//   - Le score calculé pour ces annonces est structurellement moins fiable : jardin/
//     parking valent toujours "false" par manque de donnée (pas par absence réelle),
//     ce qui les pénalise un peu à tort si ce critère compte pour toi.
// Si cette limite te gêne trop à l'usage, le plus simple est de décocher cette source
// dans Paramètres plutôt que de la debugger davantage — la donnée n'existe
// simplement pas à cet endroit de la page.

import { fetchHtml, slugify, wait, POSTAL_CODES } from "./_shared.js";

export const id = "square-habitat";
export const label = "Square Habitat";

const REGION = "hauts-de-france";
const DEPARTEMENT = "pas-de-calais";

function extractListings(html, kind, city, pageUrl) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return [];

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const items = data.itemListElement || [];
  return items
    .map((entry) => entry.item)
    .filter(Boolean)
    .map((item) => {
      const price = item.offers?.price ?? null;
      if (price === null) return null;
      return {
        source: id,
        type: kind,
        city,
        title: item.name || `${kind === "maison" ? "Maison" : "Appartement"} - ${city}`,
        price,
        surface: null, // absent du JSON-LD
        etage: null, // absent du JSON-LD
        jardin: false, // inconnu, pas "non" — voir limite en tête de fichier
        parking: false, // idem
        dpe: null,
        link: pageUrl, // pas de lien par annonce disponible, on renvoie vers la recherche
      };
    })
    .filter(Boolean);
}

export async function search(market, zones) {
  const action = market === "achat" ? "achat" : "location";
  const listings = [];

  for (const kind of ["maison", "appartement"]) {
    for (const city of zones) {
      const postal = POSTAL_CODES[city.toLowerCase()];
      if (!postal) {
        console.warn(`    ⚠️  [square-habitat] Pas de code postal connu pour "${city}", ville ignorée.`);
        continue;
      }
      const url = `https://www.squarehabitat.fr/annonces/${action}/bien/${kind}/immobilier/${REGION}/${DEPARTEMENT}/${slugify(city)}-${postal}`;
      console.log(`    [square-habitat] → ${url}`);
      const html = await fetchHtml(url, 25000);
      if (html) {
        listings.push(...extractListings(html, kind, city, url));
      }
      await wait();
    }
  }
  return listings;
}
