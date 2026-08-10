// pap.js — adaptateur PAP.fr (particulier à particulier, pas d'agences).
//
// IMPORTANT : le 403 rencontré au premier run vient probablement de la protection
// anti-bot de PAP plutôt que d'une URL mal formée (URL corrigée le 10/08 : pluriel
// "maisons"/"appartements" au lieu du singulier). Si le 403 persiste malgré des
// en-têtes plus complets, la piste suivante est un navigateur headless (Playwright)
// pour passer un éventuel challenge JS — plus lourd, à envisager seulement si
// nécessaire.

import * as cheerio from "cheerio";
import { slugify, wait } from "./_shared.js";
import fetch from "node-fetch";

export const id = "pap";
export const label = "PAP.fr";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  Referer: "https://www.pap.fr/",
};

async function fetchPapHtml(url) {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) {
    console.warn(`    ⚠️  ${url} → HTTP ${res.status}`);
    return null;
  }
  return res.text();
}

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
    const kindPlural = kind === "maison" ? "maisons" : "appartements";
    for (const city of zones) {
      const url = `https://www.pap.fr/annonce/${type}-${kindPlural}-${slugify(city)}-g`;
      console.log(`    [pap] → ${url}`);
      const html = await fetchPapHtml(url);
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
