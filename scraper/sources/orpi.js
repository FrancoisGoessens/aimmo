// orpi.js — adaptateur Orpi (réseau national d'agences, un des plus gros de France).
//
// IMPORTANT : Orpi centralise la recherche sur orpi.com plutôt que par agence locale,
// ce qui simplifie la construction d'URL par rapport à des agences indépendantes.
// Sélecteurs écrits sans accès web en direct depuis mon environnement — à vérifier/
// ajuster au premier run réel. Orpi utilise plus volontiers du rendu JS côté client
// que PAP ; si le HTML brut ne contient aucune annonce (souvent le cas avec les sites
// en React/Vue côté agence), il faudra soit trouver leur endpoint JSON interne
// (onglet Réseau du navigateur en inspectant une recherche), soit passer par un
// navigateur headless (Playwright) — plus lourd, à envisager seulement si le HTML
// brut ne suffit pas.

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
  const type = market === "achat" ? "acheter" : "louer";
  const listings = [];

  for (const kind of ["maison", "appartement"]) {
    for (const city of zones) {
      const url = `https://www.orpi.com/${type}/${kind}/${slugify(city)}/`;
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
