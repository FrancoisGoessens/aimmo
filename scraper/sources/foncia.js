// foncia.js — adaptateur Foncia (grand réseau national, présent à Boulogne-sur-Mer).
//
// URL "achat" confirmée par recherche web directe (10/08) :
// https://fr.foncia.com/achat/boulogne-sur-mer-62200/maison
// URL "location" non vérifiée par un exemple concret, mais construite par symétrie
// avec le pattern achat (Foncia utilise systématiquement action/ville-cp/type sur
// tout le reste du site) — probablement correcte, à confirmer au premier run.

import * as cheerio from "cheerio";
import { fetchHtml, slugify, wait, POSTAL_CODES } from "./_shared.js";

export const id = "foncia";
export const label = "Foncia";

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
    link: link?.startsWith("http") ? link : `https://fr.foncia.com${link ?? ""}`,
  };
}

export async function search(market, zones) {
  const action = market === "achat" ? "achat" : "location";
  const listings = [];

  for (const kind of ["maison", "appartement"]) {
    for (const city of zones) {
      const postal = POSTAL_CODES[city.toLowerCase()];
      if (!postal) {
        console.warn(`    ⚠️  [foncia] Pas de code postal connu pour "${city}", ville ignorée.`);
        continue;
      }
      const url = `https://fr.foncia.com/${action}/${slugify(city)}-${postal}/${kind}`;
      console.log(`    [foncia] → ${url}`);
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
