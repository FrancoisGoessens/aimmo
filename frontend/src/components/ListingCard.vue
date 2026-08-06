<script setup lang="ts">
import { computed } from "vue";
import type { Listing, Market } from "../types";
import { fmtMoney } from "../utils";
import { scoreVisual, dpeVisual } from "../theme";

const props = defineProps<{ listing: Listing; market: Market }>();

const priceLabel = computed(() =>
  props.market === "achat" ? fmtMoney(props.listing.price) : fmtMoney(props.listing.price) + "/mois"
);
const iconLetter = computed(() => (props.listing.type === "maison" ? "M" : "A"));
const sv = computed(() => scoreVisual(props.listing.score));
const dv = computed(() => dpeVisual(props.listing.dpe));

const chips = computed(() => {
  const c: string[] = [];
  const l = props.listing;
  if (l.surface) c.push(l.surface + " m²");
  if (l.jardin) c.push("Jardin");
  if (l.parking) c.push("Parking");
  if (l.etage !== null && l.etage !== undefined) c.push(l.etage === 0 ? "RDC" : l.etage + "ᵉ étage");
  return c;
});
</script>

<template>
  <div class="listing-card">
    <div class="listing-card__head">
      <div class="listing-card__icon">{{ iconLetter }}</div>
      <div class="listing-card__title-block">
        <div class="listing-card__title">{{ listing.title }}</div>
        <div class="listing-card__city">{{ listing.city }}</div>
      </div>
      <div class="listing-card__score" :style="{ background: sv.bg, color: sv.fg }">
        {{ listing.score.toFixed(1) }}/10
      </div>
    </div>
    <div class="listing-card__price">{{ priceLabel }}</div>
    <div class="listing-card__chips">
      <span v-for="c in chips" :key="c" class="chip">{{ c }}</span>
      <span v-if="dv" class="chip chip--dpe" :style="{ background: dv.bg, color: dv.fg }">DPE {{ listing.dpe }}</span>
    </div>
    <a :href="listing.link" target="_blank" rel="noopener" class="listing-card__link">Voir l'annonce ↗</a>
  </div>
</template>

<style scoped>
.listing-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.listing-card__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.listing-card__icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 13px;
  flex-shrink: 0;
}

.listing-card__title-block {
  flex: 1;
  min-width: 0;
}

.listing-card__title {
  font-weight: 700;
  font-size: 14px;
  line-height: 1.3;
  color: var(--text);
}

.listing-card__city {
  font-size: 12px;
  color: var(--text-soft);
  margin-top: 2px;
}

.listing-card__score {
  font-weight: 800;
  font-size: 12px;
  padding: 5px 9px;
  border-radius: 8px;
  white-space: nowrap;
}

.listing-card__price {
  font-size: 19px;
  font-weight: 800;
  color: var(--text);
}

.listing-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 9px;
  border-radius: 7px;
}

.chip--dpe {
  font-weight: 700;
}

.listing-card__link {
  text-align: center;
  padding: 9px 0;
  border-radius: 9px;
  background: var(--surface-2);
  color: var(--text);
  font-weight: 700;
  font-size: 13px;
}

.listing-card__link:hover {
  text-decoration: none;
  opacity: 0.85;
}
</style>
