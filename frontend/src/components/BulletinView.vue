<script setup lang="ts">
import { computed } from "vue";
import type { Bulletin, Market, MarketCriteria } from "../types";
import StatCard from "./StatCard.vue";
import ListingCard from "./ListingCard.vue";
import { fmtMoney, fmtDateLong } from "../utils";

const props = defineProps<{
  selected: Bulletin;
  market: Market;
  criteria: MarketCriteria;
}>();

const emit = defineEmits<{ goSettings: [] }>();

const isAchat = computed(() => props.market === "achat");

const criteriaSummary = computed(() => {
  const c = props.criteria;
  const parts: string[] = [];
  parts.push(`Budget max ${isAchat.value ? fmtMoney(c.budgetMax) : fmtMoney(c.budgetMax) + "/mois"}`);
  parts.push(`Surface min ${c.surfaceMin} m²`);
  if (c.jardin) parts.push("Jardin souhaité");
  if (c.parking) parts.push("Parking souhaité");
  parts.push(`DPE ≥ ${c.dpeMin}`);
  parts.push(props.market === "location" ? `Étage max ${c.etageMax}` : String(c.etageMax));
  parts.push(`Zones : ${c.zonesMinMinutes}-${c.zonesMaxMinutes} min de Calais Fréthun`);
  return parts.join(" · ");
});

const bulletinTitle = computed(() => {
  const s = fmtDateLong(props.selected.date);
  return "Bulletin du " + s.charAt(0).toLowerCase() + s.slice(1);
});
</script>

<template>
  <div>
    <div class="header-row">
      <div>
        <div class="header-eyebrow">
          {{ isAchat ? "Achat" : "Location" }}
          <span v-if="selected.source === 'manual'" class="manual-badge">Manuel</span>
        </div>
        <div class="header-title">{{ bulletinTitle }}</div>
      </div>
    </div>

    <div class="criteria-banner">
      <span class="criteria-banner__label">Critères actifs</span>
      <span class="criteria-banner__text">{{ criteriaSummary }}</span>
      <a href="#" @click.prevent="emit('goSettings')">Modifier</a>
    </div>

    <div class="stats-grid">
      <StatCard
        :label="isAchat ? 'Prix moyen au m²' : 'Loyer moyen'"
        :value="isAchat ? fmtMoney(selected.avgPricePerM2) + '/m²' : fmtMoney(selected.avgPrice)"
      />
      <StatCard
        label="Annonces analysées"
        :value="String(selected.totalAnalyzed)"
        :sub="`${selected.top10.length} retenues`"
      />
      <StatCard label="Meilleur score" :value="selected.bestScore.toFixed(1) + '/10'" />
    </div>

    <div class="section-title">Top 10 des annonces</div>
    <div class="listings-grid">
      <ListingCard v-for="l in selected.top10" :key="l.id" :listing="l" :market="market" />
    </div>
  </div>
</template>

<style scoped>
.header-row {
  margin-bottom: 18px;
}

.header-eyebrow {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.manual-badge {
  background: var(--success-soft);
  color: var(--success);
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 6px;
  text-transform: none;
  letter-spacing: normal;
}

.header-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text);
}

.criteria-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: var(--accent-soft);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}

.criteria-banner__label {
  color: var(--accent);
  font-weight: 800;
  font-size: 13px;
  white-space: nowrap;
}

.criteria-banner__text {
  font-size: 13px;
  color: var(--text);
  flex: 1;
  min-width: 200px;
}

.criteria-banner a {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 28px;
}

.section-title {
  font-size: 16px;
  font-weight: 800;
  margin-bottom: 14px;
  color: var(--text);
}

.listings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
}
</style>
