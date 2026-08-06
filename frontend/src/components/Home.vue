<script setup lang="ts">
import { computed } from "vue";
import type { Bulletin, Market } from "../types";
import StatCard from "./StatCard.vue";
import LineChart from "./LineChart.vue";
import { fmtMoney, computeVariation, DURATION_LABELS } from "../utils";

const props = defineProps<{
  bulletins: Bulletin[]; // historique complet du marché sélectionné, plus récent en premier
  market: Market;
  comparisonDuration: string;
}>();

const emit = defineEmits<{
  changeDuration: [duration: string];
  changeMarket: [market: Market];
  goBulletin: [id: string];
}>();

const isAchat = computed(() => props.market === "achat");
const latest = computed(() => props.bulletins[0] ?? null);
const durationOptions = ["1m", "3m", "6m", "1a", "tout"];

const chronological = computed(() => [...props.bulletins].reverse()); // plus ancien -> plus récent, pour les graphs

const pm2Points = computed(() =>
  chronological.value.map((b) => ({
    label: new Date(b.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    value: b.avgPricePerM2,
  }))
);
const analyzedPoints = computed(() =>
  chronological.value.map((b) => ({
    label: new Date(b.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    value: b.totalAnalyzed,
  }))
);
const scorePoints = computed(() =>
  chronological.value.map((b) => ({
    label: new Date(b.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    value: b.bestScore,
  }))
);

const variation = computed(() =>
  latest.value ? computeVariation(props.bulletins, latest.value.id, props.comparisonDuration) : 0
);
const varUp = computed(() => variation.value > 0.05);
const varDown = computed(() => variation.value < -0.05);
const varColor = computed(() => (varUp.value ? "var(--danger)" : varDown.value ? "var(--success)" : "var(--text-soft)"));

const typeComposition = computed(() => {
  if (!latest.value) return [];
  const total = latest.value.top10.length || 1;
  const maisons = latest.value.top10.filter((l) => l.type === "maison").length;
  return [
    { label: "Maisons", count: maisons, pct: (maisons / total) * 100 },
    { label: "Appartements", count: total - maisons, pct: ((total - maisons) / total) * 100 },
  ];
});

const dpeDistribution = computed(() => {
  if (!latest.value) return [];
  const letters = ["A", "B", "C", "D", "E", "F", "G"];
  const counts: Record<string, number> = Object.fromEntries(letters.map((l) => [l, 0]));
  latest.value.top10.forEach((l) => {
    if (l.dpe && counts[l.dpe] !== undefined) counts[l.dpe]++;
  });
  const max = Math.max(1, ...Object.values(counts));
  return letters.map((l) => ({ letter: l, count: counts[l], pct: (counts[l] / max) * 100 }));
});
</script>

<template>
  <div>
    <div class="header-row">
      <div>
        <div class="header-eyebrow">Vue d'ensemble</div>
        <div class="header-title">Dashboard</div>
      </div>
      <div class="controls">
        <div class="toggle-group">
          <button
            class="toggle-group__btn"
            :class="{ 'toggle-group__btn--active': market === 'achat' }"
            @click="emit('changeMarket', 'achat')"
          >
            Achat
          </button>
          <button
            class="toggle-group__btn"
            :class="{ 'toggle-group__btn--active': market === 'location' }"
            @click="emit('changeMarket', 'location')"
          >
            Location
          </button>
        </div>
        <div class="toggle-group">
          <button
            v-for="d in durationOptions"
            :key="d"
            class="toggle-group__btn toggle-group__btn--sm"
            :class="{ 'toggle-group__btn--active': comparisonDuration === d }"
            @click="emit('changeDuration', d)"
          >
            {{ DURATION_LABELS[d] }}
          </button>
        </div>
      </div>
    </div>

    <p v-if="!latest" class="empty">
      Aucun bulletin pour l'instant sur ce marché. Le dashboard se remplira au fil des relevés.
    </p>

    <template v-else>
      <div class="stats-grid">
        <StatCard
          :label="isAchat ? 'Prix moyen au m²' : 'Loyer moyen'"
          :value="isAchat ? fmtMoney(latest.avgPricePerM2) + '/m²' : fmtMoney(latest.avgPrice)"
        />
        <StatCard label="Variation" :value="(varUp ? '+' : '') + variation.toFixed(1) + ' %'" :sub="`vs ${DURATION_LABELS[comparisonDuration]}`" :value-color="varColor" :sub-color="varColor" />
        <StatCard label="Bulletins générés" :value="String(bulletins.length)" />
        <StatCard label="Meilleur score (dernier)" :value="latest.bestScore.toFixed(1) + '/10'" />
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card__title">{{ isAchat ? "Prix moyen au m²" : "Loyer moyen au m²" }} dans le temps</div>
          <LineChart :points="pm2Points" :format-value="(n) => Math.round(n) + ' €'" />
        </div>
        <div class="chart-card">
          <div class="chart-card__title">Annonces analysées par relevé</div>
          <LineChart :points="analyzedPoints" color="var(--success)" />
        </div>
        <div class="chart-card">
          <div class="chart-card__title">Meilleur score par relevé</div>
          <LineChart :points="scorePoints" color="var(--amber)" :format-value="(n) => n.toFixed(1)" />
        </div>
        <div class="chart-card">
          <div class="chart-card__title">Composition du dernier top 10</div>
          <div class="bars">
            <div v-for="t in typeComposition" :key="t.label" class="bar-row">
              <span class="bar-row__label">{{ t.label }}</span>
              <div class="bar-row__track">
                <div class="bar-row__fill" :style="{ width: t.pct + '%' }"></div>
              </div>
              <span class="bar-row__count">{{ t.count }}</span>
            </div>
          </div>
          <div class="chart-card__title" style="margin-top: 18px">Répartition DPE du dernier top 10</div>
          <div class="bars">
            <div v-for="d in dpeDistribution" :key="d.letter" class="bar-row">
              <span class="bar-row__label bar-row__label--letter">{{ d.letter }}</span>
              <div class="bar-row__track">
                <div class="bar-row__fill bar-row__fill--amber" :style="{ width: d.pct + '%' }"></div>
              </div>
              <span class="bar-row__count">{{ d.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.header-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 22px;
}

.header-eyebrow {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.header-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text);
}

.controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.toggle-group {
  display: flex;
  background: var(--surface-2);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
}

.toggle-group__btn {
  padding: 7px 14px;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 700;
  background: transparent;
  color: var(--text-soft);
}

.toggle-group__btn--sm {
  padding: 6px 10px;
  font-size: 12px;
}

.toggle-group__btn--active {
  background: var(--accent);
  color: var(--accent-fg);
}

.empty {
  font-size: 13px;
  color: var(--text-soft);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

.chart-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
}

.chart-card__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 12px;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.bar-row__label {
  width: 90px;
  flex-shrink: 0;
  color: var(--text-soft);
  font-weight: 600;
}

.bar-row__label--letter {
  width: 16px;
}

.bar-row__track {
  flex: 1;
  height: 8px;
  background: var(--surface-2);
  border-radius: 4px;
  overflow: hidden;
}

.bar-row__fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
}

.bar-row__fill--amber {
  background: var(--amber);
}

.bar-row__count {
  width: 20px;
  text-align: right;
  color: var(--text-soft);
  font-weight: 700;
}
</style>
