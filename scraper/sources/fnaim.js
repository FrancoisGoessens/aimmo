// fnaim.js — adaptateur FNAIM.fr (agrégateur d'annonces de plusieurs agences membres
// du réseau FNAIM — pas une agence unique, ce qui donne plus de volume d'un coup).
//
// URL confirmée par recherche web directe (10/08) :
// https://www.fnaim.fr/liste-annonces-immobilieres/17-acheter-maison-<ville>-<cp>.htm
// https://www.fnaim.fr/liste-annonces-immobilieres/18-location-maison-<ville>-<cp>.htm
// Le nombre 17/18 est une constante fixe (achat vs location), pas liée à la ville —
// confirmé identique sur plusieurs villes différentes. Nécessite en revanche le code
// postal exact (contrairement à Orpi) : table dans _shared.js à étoffer si tu ajoutes
// des communes dans compute-communes.js. Structure de card confirmée par un vrai
// extrait HTML fourni le 10/08 : <li class="item"> avec le titre dans
// h3 a.linkAnnonce, le prix dans p.price.

import * as cheerio from "cheerio";
import { fetchHtml, slugify, wait, POSTAL_CODES } from "./_shared.js";

export const id = "fnaim";
export const label = "FNAIM.fr";

const CODE = { achat: "17", location: "18" };
const ACTION = { achat: "acheter", location: "location" };

function parseCard($, el, kind, city) {
  const card = $(el);
  const title = card.find("h3 a.linkAnnonce").first().text().trim();
  const priceText = card.find("p.price").first().text();
  const link = card.find("a.linkAnnonce").first().attr("href");
  const fullText = card.text();
  const surfaceMatch = fullText.match(/(\d+)\s*m(?:²|2)\b/);
  const etageMatch = fullText.match(/(\d+)(?:er|ème|e)\s?étage/i);
  const price = priceText ? Number(priceText.replace(/[^\d]/g, "")) : null;
  const surface = surfaceMatch ? Number(surfaceMatch[1]) : null;
  const etage =
    kind === "maison" ? null : etageMatch ? Number(etageMatch[1]) : /rez.de.chauss/i.test(fullText) ? 0 : null;

  if (!title || price === null) return null;

  return {
    source: id,
    type: kind,
    city,
    title,
    price,
    surface,
    etage,
    jardin: /jardin/i.test(fullText),
    parking: /(parking|garage|box)/i.test(fullText),
    dpe: fullText.match(/DPE\s?:?\s?([A-G])\b/i)?.[1] ?? fullText.match(/[Cc]lasse énergie\s?([A-G])/)?.[1] ?? null,
    link: link?.startsWith("http") ? link : `https://www.fnaim.fr${link ?? ""}`,
  };
}

export async function search(market, zones) {
  const listings = [];

  for (const kind of ["maison", "appartement"]) {
    for (const city of zones) {
      const postal = POSTAL_CODES[city.toLowerCase()];
      if (!postal) {
        console.warn(`    ⚠️  [fnaim] Pas de code postal connu pour "${city}", ville ignorée.`);
        continue;
      }
      const url = `https://www.fnaim.fr/liste-annonces-immobilieres/${CODE[market]}-${ACTION[market]}-${kind}-${slugify(city)}-${postal}.htm`;
      console.log(`    [fnaim] → ${url}`);
      const html = await fetchHtml(url);
      if (html) {
        const $ = cheerio.load(html);
        $("li.item")
          .toArray()
          .forEach((el) => {
            const parsed = parseCard($, el, kind, city);
            if (parsed) listings.push(parsed);
          });
      }
      await wait();
    }
  }
  return listings;
}
