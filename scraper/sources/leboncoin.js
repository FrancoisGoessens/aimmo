// leboncoin.js — adaptateur Leboncoin. Séparé des autres sources car : (1) c'est le
// gros volume réel d'annonces dans le secteur, (2) c'est aussi le site avec la
// protection anti-bot la plus sérieuse (détection de comportement type Datadome),
// donc le plus susceptible de casser ou de bloquer l'IP du runner GitHub Actions.
// Utilisé séparément (déclenchement manuel ou auto hebdo optionnel), jamais dans le
// même run que les autres sources.
//
// IMPORTANT : sélecteurs non testés en direct (pas d'accès web depuis mon
// environnement). Probabilité de casse/blocage plus élevée qu'avec les autres
// adaptateurs — voir README pour les symptômes possibles (0 résultat, HTTP 403/429,
// CAPTCHA renvoyé à la place du HTML).

import * as cheerio from "cheerio";
import { fetchHtml, slugify, wait } from "./_shared.js";

export const id = "leboncoin";
export const label = "Leboncoin";

// ---------------------------------------------------------------------------
// Détection d'arnaques — spécifique à Leboncoin, pas nécessaire sur les sites
// d'agences qu'on choisit nous-même. Trois signaux classiques :
//   1. Prix affiché anormalement bas (le fameux "1€" pour passer les filtres)
//   2. Un montant différent du prix affiché est mentionné dans le texte
//   3. Le texte pousse vers un contact hors-plateforme (souvent la vraie arnaque)
// Un seul signal suffit à flaguer — mieux vaut exclure une annonce limite plutôt
// que risquer d'afficher une arnaque dans le top 10.
// ---------------------------------------------------------------------------
const OFF_PLATFORM_KEYWORDS = /whatsapp|whats app|telegram|contactez[-\s]?moi (par|sur) (mail|email|whatsapp)/i;

export function scamCheck(listing, market) {
  const reasons = [];

  const floorPrice = market === "achat" ? 5000 : 100;
  if (listing.price && listing.price < floorPrice) {
    reasons.push(`prix suspect (${listing.price} €)`);
  }

  if (listing.description) {
    const priceLikeMatches = listing.description.match(/(\d[\d\s]{2,})\s?€/g) || [];
    const mentionedPrices = priceLikeMatches.map((m) => Number(m.replace(/[^\d]/g, "")));
    const mismatch = mentionedPrices.some((p) => p > floorPrice && Math.abs(p - listing.price) / p > 0.3);
    if (mismatch) reasons.push("prix incohérent avec le texte de l'annonce");

    if (OFF_PLATFORM_KEYWORDS.test(listing.description)) {
      reasons.push("demande de contact hors plateforme");
    }
  }

  return { suspicious: reasons.length > 0, reasons };
}

function parseCard($, el, kind, city) {
  const card = $(el);
  const title = card.find("[data-qa-id='aditem_title'], h2, h3").first().text().trim();
  const priceText = card.find("[data-qa-id='aditem_price'], .price").first().text().trim();
  const description = card.find(".description, [data-qa-id='aditem_description']").first().text().trim();
  const link = card.find("a").first().attr("href");
  const surfaceText = card.text().match(/(\d+)\s?m²/)?.[1];
  const etageText = card.text().match(/(\d+)(?:er|ème|e)\s?étage/i)?.[1];
  const price = priceText ? Number(priceText.replace(/[^\d]/g, "")) : null;
  const surface = surfaceText ? Number(surfaceText) : null;
  const etage = kind === "maison" ? null : etageText ? Number(etageText) : /rez.de.chauss/i.test(title) ? 0 : null;

  if (!title || price === null) return null;

  return {
    source: id,
    type: kind,
    city,
    title,
    price,
    surface,
    etage,
    description,
    jardin: /jardin/i.test(card.text()),
    parking: /(parking|garage|box)/i.test(card.text()),
    dpe: card.text().match(/DPE\s?:?\s?([A-G])/i)?.[1] ?? null,
    link: link?.startsWith("http") ? link : `https://www.leboncoin.fr${link ?? ""}`,
  };
}

export async function search(market, zones) {
  const category = market === "achat" ? "ventes_immobilieres" : "locations";
  const listings = [];
  const flagged = [];

  for (const kind of ["maison", "appartement"]) {
    for (const city of zones) {
      const url = `https://www.leboncoin.fr/recherche?category=${category}&locations=${slugify(city)}&real_estate_type=${kind === "maison" ? "1" : "2"}`;
      console.log(`    [leboncoin] → ${url}`);
      const html = await fetchHtml(url);
      if (html) {
        const $ = cheerio.load(html);
        $("[data-qa-id='aditem_container'], article")
          .toArray()
          .forEach((el) => {
            const parsed = parseCard($, el, kind, city);
            if (!parsed) return;
            const check = scamCheck(parsed, market);
            if (check.suspicious) {
              flagged.push({ title: parsed.title, link: parsed.link, reasons: check.reasons });
            } else {
              listings.push(parsed);
            }
          });
      }
      await wait(2000); // marge plus large que les autres sources, plus sensible côté anti-bot
    }
  }

  if (flagged.length) {
    console.log(`    ⚠️  ${flagged.length} annonce(s) écartée(s) comme suspectes :`);
    flagged.forEach((f) => console.log(`       - ${f.title} (${f.reasons.join(", ")})`));
  }

  return { listings, flaggedCount: flagged.length };
}
