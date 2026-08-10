// orpi.js — adaptateur Orpi (réseau national d'agences, un des plus gros de France).
//
// URL confirmée par recherche web directe (10/08) :
// https://www.orpi.com/annonces-immobilieres-<slug-ville>/vente-maison/
// Pas de code postal ni d'identifiant interne nécessaire, contrairement à PAP — bien
// plus simple. Sélecteurs de parsing HTML en revanche non vérifiés (page potentiellement
// rendue en JS côté client) : à ajuster si le HTML brut ressort vide malgré un 200 OK.

import * as cheerio from "cheerio";
import { fetchHtml, slugify, wait } from "./_shared.js";

export const id = "orpi";
export const label = "Orpi";

function parseCard($, el, kind, city) {
  const card = $(el);
  const title = card.find(".card-title, h2, h3, .listing-title").first().text().trim();
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
    link: link?.startsWith("http") ? link : `https://www.orpi.com${link ?? ""}`,
  };
}

export async function search(market, zones) {
  const type = market === "achat" ? "vente" : "location";
  const listings = [];

  for (const kind of ["maison", "appartement"]) {
    for (const city of zones) {
      const url = `https://www.orpi.com/annonces-immobilieres-${slugify(city)}/${type}-${kind}/`;
      console.log(`    [orpi] → ${url}`);
      const html = await fetchHtml(url);
      if (html) {
        const $ = cheerio.load(html);
        $(".listing-card, .property-card, article")
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
