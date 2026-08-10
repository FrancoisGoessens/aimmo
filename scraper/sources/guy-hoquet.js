// guy-hoquet.js — adaptateur Guy Hoquet (réseau national d'agences).
//
// IMPORTANT : mêmes réserves que pour orpi.js — sélecteurs non testés en direct, et
// risque de rendu JS côté client nécessitant un navigateur headless si le HTML brut
// est vide au premier run. À vérifier en priorité si ce site sort 0 résultat alors
// que la requête HTTP répond bien (200).

import * as cheerio from "cheerio";
import { fetchHtml, slugify, wait } from "./_shared.js";

export const id = "guy-hoquet";
export const label = "Guy Hoquet";

function parseCard($, el, kind, city) {
  const card = $(el);
  const title = card.find(".property-title, h2, h3").first().text().trim();
  const priceText = card.find(".property-price, .price").first().text().trim();
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
    link: link?.startsWith("http") ? link : `https://www.guy-hoquet.com${link ?? ""}`,
  };
}

export async function search(market, zones) {
  const type = market === "achat" ? "acheter" : "louer";
  const listings = [];

  for (const kind of ["maison", "appartement"]) {
    for (const city of zones) {
      const url = `https://www.guy-hoquet.com/${type}/${kind}/${slugify(city)}`;
      console.log(`    [guy-hoquet] → ${url}`);
      const html = await fetchHtml(url);
      if (html) {
        const $ = cheerio.load(html);
        $(".property-card, .listing-item, article")
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
