// pap.js — adaptateur PAP.fr (particulier à particulier, pas d'agences).
//
// IMPORTANT : sélecteurs écrits sans accès web en direct depuis mon environnement,
// à vérifier/ajuster au premier run réel (cf. README).

import * as cheerio from "cheerio";
import { fetchHtml, slugify, wait } from "./_shared.js";

export const id = "pap";
export const label = "PAP.fr";

function parseCard($, el, kind, city) {
  const card = $(el);
  const title = card.find(".item-title, h3, .item-name").first().text().trim();
  const priceText = card.find(".item-price, .price").first().text().trim();
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
    link: link?.startsWith("http") ? link : `https://www.pap.fr${link ?? ""}`,
  };
}

export async function search(market, zones) {
  const type = market === "achat" ? "vente" : "location";
  const listings = [];

  for (const kind of ["maison", "appartement"]) {
    for (const city of zones) {
      const url = `https://www.pap.fr/annonce/${type}-${kind}-${slugify(city)}-g`;
      console.log(`    [pap] → ${url}`);
      const html = await fetchHtml(url);
      if (html) {
        const $ = cheerio.load(html);
        $(".item, .search-list-item, article")
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
