// compute-communes.js
// Régénère frontend/public/data/communes-temps.json avec de VRAIS temps de trajet,
// via l'API publique OSRM (gratuite, sans clé). Le fichier livré avec le repo contient
// des estimations manuelles pour que le site fonctionne dès le départ — lance ce script
// pour les remplacer par des temps réels.
//
// Usage : node compute-communes.js
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

// Liste de communes candidates à tester — étoffe cette liste si tu veux couvrir plus
// large (ou si le résultat manque des communes qui t'intéressent).
const CANDIDATES = [
  { name: "Coquelles", lat: 50.9427, lng: 1.8199 },
  { name: "Calais", lat: 50.9513, lng: 1.8587 },
  { name: "Sangatte", lat: 50.9497, lng: 1.7729 },
  { name: "Marck", lat: 50.9622, lng: 1.9455 },
  { name: "Guînes", lat: 50.8579, lng: 1.8709 },
  { name: "Marquise", lat: 50.8195, lng: 1.7061 },
  { name: "Ardres", lat: 50.856, lng: 1.9885 },
  { name: "Wissant", lat: 50.8829, lng: 1.6602 },
  { name: "Licques", lat: 50.8371, lng: 1.9522 },
  { name: "Wimille", lat: 50.7735, lng: 1.627 },
  { name: "Wimereux", lat: 50.7679, lng: 1.6134 },
  { name: "Desvres", lat: 50.6693, lng: 1.8371 },
  { name: "Saint-Martin-Boulogne", lat: 50.728, lng: 1.6187 },
  { name: "Boulogne-sur-Mer", lat: 50.7264, lng: 1.6147 },
  { name: "Condette", lat: 50.6767, lng: 1.6379 },
  { name: "Outreau", lat: 50.7106, lng: 1.6018 },
  { name: "Le Portel", lat: 50.7157, lng: 1.5794 },
  { name: "Hardelot-Plage", lat: 50.6538, lng: 1.5964 },
  { name: "Samer", lat: 50.6438, lng: 1.7373 },
  { name: "Andres", lat: 50.8899, lng: 1.9319 },
  { name: "Nielles-lès-Ardres", lat: 50.8317, lng: 1.9946 },
  { name: "Bonningues-lès-Ardres", lat: 50.8272, lng: 1.9328 },
  { name: "Rety", lat: 50.8129, lng: 1.7818 },
  { name: "Landrethun-le-Nord", lat: 50.8563, lng: 1.6975 },
  { name: "Escalles", lat: 50.9186, lng: 1.7028 },
  { name: "Fréthun", lat: 50.9127, lng: 1.8256 },
  { name: "Peuplingues", lat: 50.9227, lng: 1.7746 },
];

async function drivingMinutes(from, to) {
  // exclude=motorway : évite les autoroutes (donc, en pratique en France, la quasi-
  // totalité des péages). OSRM public demo server — usage raisonnable uniquement.
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&exclude=motorway`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  const seconds = data.routes?.[0]?.duration;
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

  results.sort((a, b) => a.minutes - b.minutes);
  const output = { generatedAt: new Date().toISOString(), communes: results };
  await fs.writeFile(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\n✅ ${results.length} communes écrites dans ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("❌ Erreur :", err);
  process.exit(1);
});
