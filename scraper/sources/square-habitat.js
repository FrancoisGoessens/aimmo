// square-habitat.js — adaptateur Square Habitat (réseau Crédit Agricole, présence
// confirmée directement sur ta zone : Boulogne-sur-Mer, Hardelot, Outreau, Desvres,
// Saint-Martin-Boulogne, Le Portel...).
//
// URL confirmée par recherche web directe (10/08) :
// https://www.squarehabitat.fr/annonces/achat/bien/maison/immobilier/hauts-de-france/pas-de-calais/boulogne-sur-mer-62200
// https://www.squarehabitat.fr/annonces/location/bien/maison/immobilier/hauts-de-france/pas-de-calais/boulogne-sur-mer-62200
// region/département fixes ("hauts-de-france"/"pas-de-calais") vu que tout ton
// secteur de recherche est dans ce coin — à adapter si un jour tu élargis ailleurs.

import * as cheerio from "cheerio";
import { fetchHtml, slugify, wait, POSTAL_CODES } from "./_shared.js";

export const id = "square-habitat";
export const label = "Square Habitat";

const REGION = "hauts-de-france";
const DEPARTEMENT = "pas-de-calais";

function parseCard($, el, kind, city) {
  const card = $(el);
  const title = card.find("h2, h3, .card-title").first().text().trim();
  const priceText = card.find(".price, .card-price").first().text().trim();
  const link = card.find("a").first().attr("href");
  const surfaceText = card.text().match(/(\d+)\s?m²/)?.[1];
  const etageText = card.text().match(/(\d+)(?:er|ème|e)\s?étage/i)?.[1];
  const price = priceText ? Number(priceText.replace(/[^\d]/g, "")) : null;
  const surface = surfaceText ? Number(surfaceText) : null;
  const etage = kind === "maison" ? null : etageText ? Number(etageText) : /rez.de.chauss/i.test(title) ? 0 : null;

  if (!title || !price) return null;

  return {
    source: id,
    type: kind,
    city,
    title,
    price,
    surface,
    etage,
    jardin: /jardin/i.test(card.text()),
    parking: /(parking|garage|box)/i.test(card.text()),
    dpe: card.text().match(/DPE\s?:?\s?([A-G])/i)?.[1] ?? null,
    link: link?.startsWith("http") ? link : `https://www.squarehabitat.fr${link ?? ""}`,
  };
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
      const html = await fetchHtml(url);
      if (html) {
        const $ = cheerio.load(html);
        $(".property-card, .listing-item, article, .result-item")
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
