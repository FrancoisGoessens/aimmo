// orpi.js — adaptateur Orpi (réseau national d'agences, un des plus gros de France).
//
// URL et sélecteurs de parsing confirmés par un vrai extrait HTML fourni le 10/08
// (recherche "vente-maison" à Marquise) : cards en <article class="c-estate-thumb">,
// prix dans .c-estate-thumb__price-tag .u-h4, infos bien dans
// .c-estate-thumb__infos__estate, ville dans .c-estate-thumb__infos__location.

import * as cheerio from "cheerio";
import { fetchHtml, slugify, wait } from "./_shared.js";

export const id = "orpi";
export const label = "Orpi";

function parseCard($, el, kind, city) {
  const card = $(el);
  const infosText = card
    .find(".c-estate-thumb__infos__estate")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const cityText = card
    .find(".c-estate-thumb__infos__location")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const priceText = card.find(".c-estate-thumb__price-tag .u-h4").first().text();
  const link = card.find(".c-estate-thumb__infos__estate a").first().attr("href");
  const fullText = card.text();
  const surfaceMatch = fullText.match(/(\d+)\s*m(?:²|2)\b/);
  const etageMatch = fullText.match(/(\d+)(?:er|ème|e)\s?étage/i);
  const price = priceText ? Number(priceText.replace(/[^\d]/g, "")) : null;
  const surface = surfaceMatch ? Number(surfaceMatch[1]) : null;
  const etage =
    kind === "maison" ? null : etageMatch ? Number(etageMatch[1]) : /rez.de.chauss/i.test(fullText) ? 0 : null;

  if (price === null) return null;

  return {
    source: id,
    type: kind,
    city: cityText || city,
    title: infosText || `${kind === "maison" ? "Maison" : "Appartement"} - ${cityText || city}`,
    price,
    surface,
    etage,
    jardin: /jardin/i.test(fullText),
    parking: /(parking|garage|box)/i.test(fullText),
    dpe: fullText.match(/DPE\s?:?\s?([A-G])\b/i)?.[1] ?? null,
    link: link?.startsWith("http") ? link : `https://www.orpi.com${link ?? ""}`,
  };
}

export async function search(market, zones) {
  const listings = [];

  for (const kind of ["maison", "appartement"]) {
    for (const city of zones) {
      const slug = slugify(city);
      const url =
        market === "achat"
          ? `https://www.orpi.com/annonces-immobilieres-${slug}/vente-${kind}/`
          : `https://www.orpi.com/location-immobiliere-${slug}/louer-${kind}/`;
      console.log(`    [orpi] → ${url}`);
      const html = await fetchHtml(url);
      if (html) {
        const $ = cheerio.load(html);
        $("article.c-estate-thumb")
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
