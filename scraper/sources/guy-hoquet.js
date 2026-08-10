// guy-hoquet.js — adaptateur Guy Hoquet (réseau national d'agences).
//
// URL "achat" confirmée par recherche web directe (10/08) :
// https://www.guy-hoquet.com/achat-immobilier/<slug-ville>/maison-vendre
//
// URL "location" : PAS confirmée. Le site Guy Hoquet structure ses pages de location
// par région/département plutôt que par ville sur le domaine principal (contrairement
// à l'achat, qui est bien par ville) — je n'ai trouvé aucun exemple de page location
// par ville. Le pattern ci-dessous est une tentative par analogie avec le pattern
// achat, PAS vérifiée. Si elle sort 0 résultat ou une 404, c'est probablement qu'elle
// n'existe tout simplement pas sous cette forme — dans ce cas, le plus simple est de
// désactiver Guy Hoquet pour le marché Location dans Paramètres (case à décocher),
// et de le garder seulement pour l'Achat où le pattern est fiable.

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
  const listings = [];

  for (const kind of ["maison", "appartement"]) {
    for (const city of zones) {
      const slug = slugify(city);
      const url =
        market === "achat"
          ? `https://www.guy-hoquet.com/achat-immobilier/${slug}/${kind}-vendre`
          : `https://www.guy-hoquet.com/location-immobilier/${slug}/${kind}-louer`; // non vérifiée, voir commentaire en tête de fichier
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
