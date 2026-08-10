// compute-communes.js
// Régénère frontend/public/data/communes-temps.json avec de VRAIS temps de trajet vers
// Calais Fréthun, en évitant les péages (autoroutes gratuites autorisées), via
// OpenRouteService (gratuit avec clé, 2000 requêtes/jour offertes).
//
// Prérequis : une clé API gratuite sur https://openrouteservice.org/dev/#/signup,
// à passer en variable d'environnement ORS_API_KEY.
//
// Usage :
//   ORS_API_KEY=ta_cle node compute-communes.js        (Mac/Linux)
//   $env:ORS_API_KEY="ta_cle"; node compute-communes.js  (Windows PowerShell)
//
// Limite honnête : je n'ai pas pu exécuter ce script moi-même (pas d'accès réseau vers
// OSRM depuis mon environnement), donc il n'est pas garanti de tourner du premier coup.
// OSRM's public demo server route service accepte un paramètre pour éviter les autoroutes
// (proxy raisonnable pour éviter les péages, pas 100% équivalent - la France a quelques
// routes à péage hors autoroute, rares).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fetch from "node-fetch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "frontend", "public", "data", "communes-temps.json");
const MAX_MINUTES = 30;

// Gare de Calais-Fréthun
const DESTINATION = { lat: 50.9227, lng: 1.8058 };

// Liste de communes candidates à tester — recentrée sur le corridor côtier Calais/
// Fréthun ↔ Boulogne, pour rester cohérente avec Merlimont (vie du week-end, famille,
// médecins). Les communes plus au nord/à l'intérieur (Calais, Sangatte, Guînes, Ardres...)
// ont été retirées : elles étaient certes proches de Fréthun mais à 45-60 km de
// Merlimont, ce qui n'avait plus de sens vu tes contraintes. Étoffe cette liste si tu
// veux couvrir plus large.
// Coordonnées exactes pour Offrethun, Baincthun, Isques et Saint-Étienne-au-Mont
// (Wikipédia) ; estimées pour Wacquinghen, Echinghen, Saint-Léonard et Pont-de-Briques
// (pas trouvé de source avec coordonnées précises) — l'imprécision
// reste mineure, ORS raccroche de toute façon au réseau routier le plus proche
// (radiuses ci-dessous).
const CANDIDATES = [
  { name: "Wimille", lat: 50.7735, lng: 1.627 },
  { name: "Wimereux", lat: 50.7679, lng: 1.6134 },
  { name: "Saint-Martin-Boulogne", lat: 50.728, lng: 1.6187 },
  { name: "Boulogne-sur-Mer", lat: 50.7264, lng: 1.6147 },
  { name: "Le Portel", lat: 50.7157, lng: 1.5794 },
  { name: "Desvres", lat: 50.6693, lng: 1.8371 },
  { name: "Outreau", lat: 50.7106, lng: 1.6018 },
  { name: "Condette", lat: 50.6767, lng: 1.6379 },
  { name: "Samer", lat: 50.6438, lng: 1.7373 },
  { name: "Hardelot-Plage", lat: 50.6538, lng: 1.5964 },
  { name: "Marquise", lat: 50.8195, lng: 1.7061 },
  { name: "Offrethun", lat: 50.7847, lng: 1.6925 },
  { name: "Wacquinghen", lat: 50.815, lng: 1.665 },
  { name: "Baincthun", lat: 50.7106, lng: 1.6811 },
  { name: "Echinghen", lat: 50.705, lng: 1.66 },
  { name: "Saint-Léonard", lat: 50.705, lng: 1.625 },
  { name: "Isques", lat: 50.6767, lng: 1.6508 },
  { name: "Saint-Étienne-au-Mont", lat: 50.6822, lng: 1.6269 },
];

async function drivingMinutes(from, to) {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) throw new Error("Variable ORS_API_KEY absente (clé OpenRouteService requise)");

  const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
      options: { avoid_features: ["tollways"] }, // évite les péages, autoroutes gratuites OK
      radiuses: [2000, 2000], // tolère les points un peu excentrés (ex: bord de plage) sans échouer
    }),
  });
  if (!res.ok) throw new Error(`ORS HTTP ${res.status}`);
  const data = await res.json();
  const seconds = data.routes?.[0]?.summary?.duration;
  if (seconds === undefined) throw new Error("Pas de route trouvée");
  return Math.round(seconds / 60);
}

async function main() {
  const results = [];
  for (const c of CANDIDATES) {
    try {
      const minutes = await drivingMinutes(c, DESTINATION);
      console.log(`${c.name}: ${minutes} min`);
      if (minutes <= MAX_MINUTES) {
        results.push({ name: c.name, minutes, lat: c.lat, lng: c.lng });
      }
      await new Promise((r) => setTimeout(r, 1200)); // reste correct vis-à-vis du serveur public OSRM
    } catch (err) {
      console.warn(`⚠️  ${c.name} : ${err.message} (ignorée)`);
    }
  }

  if (results.length === 0) {
    console.error(
      "\n❌ Aucune commune calculée avec succès — le fichier existant n'a PAS été touché, par sécurité."
    );
    process.exit(1);
  }

  results.sort((a, b) => a.minutes - b.minutes);
  const output = { generatedAt: new Date().toISOString(), communes: results };
  await fs.writeFile(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\n✅ ${results.length} communes écrites dans ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("❌ Erreur :", err);
  process.exit(1);
});
