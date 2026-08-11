import type { Bulletin } from "./types";

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtMoney(n: number): string {
  return Math.round(n).toLocaleString("fr-FR") + " €";
}

export function fmtDate(iso: string): string {
  return cap(
    new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
  );
}

export function fmtDateLong(iso: string): string {
  return cap(
    new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  );
}

export interface SidebarGroup {
  key: string;
  label: string;
  type: "month" | "year";
  items: Bulletin[];
}

export interface SidebarData {
  recent: Bulletin[];
  groups: SidebarGroup[];
}

// Bulletins doivent déjà être triés du plus récent au plus ancien.
// "Récents" = les 7 derniers jours (fenêtre de temps réelle), pas un nombre fixe
// d'éléments — sinon deux bulletins du même jour peuvent se retrouver éclatés entre
// "récents" et le groupe du mois, ce qui n'a aucun sens visuellement.
export function buildSidebarGroups(bulletins: Bulletin[], now: Date): SidebarData {
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recent = bulletins.filter((b) => new Date(b.date) >= sevenDaysAgo);
  const rest = bulletins.filter((b) => new Date(b.date) < sevenDaysAgo);
  const groups: SidebarGroup[] = [];
  const map = new Map<string, SidebarGroup>();

  rest.forEach((b) => {
    const d = new Date(b.date);
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    let key: string, label: string, type: "month" | "year";
    if (monthsAgo < 12) {
      key = `m-${d.getFullYear()}-${d.getMonth()}`;
      label = cap(d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
      type = "month";
    } else {
      key = `y-${d.getFullYear()}`;
      label = String(d.getFullYear());
      type = "year";
    }
    if (!map.has(key)) {
      const g: SidebarGroup = { key, label, type, items: [] };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key)!.items.push(b);
  });

  return { recent, groups };
}

const DURATION_OFFSETS: Record<string, number> = { "1m": 8, "3m": 26, "6m": 52, "1a": 104 };
export const DURATION_LABELS: Record<string, string> = {
  "1m": "1 mois",
  "3m": "3 mois",
  "6m": "6 mois",
  "1a": "1 an",
  tout: "Tout",
};

// bulletins : liste complète du marché, triée du plus récent au plus ancien.
// selectedId : bulletin actuellement affiché.
export function computeVariation(bulletins: Bulletin[], selectedId: string, duration: string): number {
  const idx = bulletins.findIndex((b) => b.id === selectedId);
  if (idx === -1) return 0;
  const offset = DURATION_OFFSETS[duration] ?? bulletins.length - 1;
  const cmpIdx = Math.min(bulletins.length - 1, idx + offset);
  const cur = bulletins[idx];
  const past = bulletins[cmpIdx];
  if (!past || !past.avgPricePerM2 || past.id === cur.id) return 0;
  return ((cur.avgPricePerM2 - past.avgPricePerM2) / past.avgPricePerM2) * 100;
}
