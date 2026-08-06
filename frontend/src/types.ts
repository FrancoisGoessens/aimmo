export type Market = "achat" | "location";
export type PropertyType = "maison" | "appartement";
export type BulletinSource = "auto" | "manual";

export interface Listing {
  id: string;
  type: PropertyType;
  city: string;
  title: string;
  price: number;
  surface: number | null;
  etage: number | null; // null = maison / non applicable, 0 = RDC
  jardin: boolean;
  parking: boolean;
  dpe: string | null; // lettre A-G
  score: number; // 0-10
  pricePerM2: number | null;
  link: string;
}

export interface Bulletin {
  id: string;
  market: Market;
  date: string; // ISO
  source: BulletinSource;
  avgPricePerM2: number;
  avgPrice: number;
  totalAnalyzed: number;
  bestScore: number;
  top10: Listing[];
}

export interface MarketCriteria {
  zonesMinMinutes: number;
  zonesMaxMinutes: number;
  budgetMax: number;
  surfaceMin: number;
  etageMax: string | number; // texte libre pour l'achat, nombre pour la location
  jardin: boolean;
  parking: boolean;
  dpeMin: string;
}

export interface CommuneTemps {
  name: string;
  minutes: number;
  lat: number;
  lng: number;
}
