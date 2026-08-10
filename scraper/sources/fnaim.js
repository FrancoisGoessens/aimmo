// fnaim.js — adaptateur FNAIM.fr (agrégateur d'annonces de plusieurs agences membres
// du réseau FNAIM — pas une agence unique, ce qui donne plus de volume d'un coup).
//
// URL confirmée par recherche web directe (10/08) :
// https://www.fnaim.fr/liste-annonces-immobilieres/17-acheter-maison-<ville>-<cp>.htm
// https://www.fnaim.fr/liste-annonces-immobilieres/18-location-maison-<ville>-<cp>.htm
// Le nombre 17/18 est une constante fixe (achat vs location), pas liée à la ville —
// confirmé identique sur plusieurs villes différentes. Nécessite en revanche le code
// postal exact (contrairement à Orpi) : table ci-dessous à étoffer si tu ajoutes des
// communes dans compute-communes.js sans les avoir ajoutées ici.

import * as cheerio from "cheerio";
import { fetchHtml, slugify, wait, POSTAL_CODES } from "./_shared.js";

export const id = "fnaim";
export const label = "FNAIM.fr";

const CODE = { achat: "17", location: "18" };
const ACTION = { achat: "acheter", location: "location" };

function parseCard($, el, kind, city) {
  const card = $(el);
  const title = card.find("h2, h3, .card-title, .listing-title").first().text().trim();
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
    dpe: card.text().match(/DPE\s?:?\s?([A-G])/i)?.[1] ?? card.text().match(/[Cc]lasse énergie\s?([A-G])/)?.[1] ?? null,
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
