<script setup lang="ts">
import { computed } from "vue";

interface Point {
  label: string;
  value: number;
}

const props = defineProps<{
  points: Point[];
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
}>();

const H = computed(() => props.height ?? 140);
const W = 560;
const PAD = 24;

const values = computed(() => props.points.map((p) => p.value));
const min = computed(() => Math.min(...values.value));
const max = computed(() => Math.max(...values.value));
const range = computed(() => max.value - min.value || 1);

const coords = computed(() => {
  const n = props.points.length;
  if (n === 0) return [];
  return props.points.map((p, i) => {
    const x = n === 1 ? W / 2 : PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = H.value - PAD - ((p.value - min.value) / range.value) * (H.value - PAD * 2);
    return { x, y, ...p };
  });
});

const pathD = computed(() => {
  if (coords.value.length === 0) return "";
  return coords.value.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
});

const areaD = computed(() => {
  if (coords.value.length === 0) return "";
  const first = coords.value[0];
  const last = coords.value[coords.value.length - 1];
  return `${pathD.value} L ${last.x.toFixed(1)} ${H.value - PAD} L ${first.x.toFixed(1)} ${H.value - PAD} Z`;
});

const fmt = (n: number) => (props.formatValue ? props.formatValue(n) : String(Math.round(n)));
</script>

<template>
  <div class="chart">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="chart__svg">
      <path :d="areaD" :fill="color ?? 'var(--accent)'" opacity="0.08" />
      <path :d="pathD" fill="none" :stroke="color ?? 'var(--accent)'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle
        v-for="(c, i) in coords"
        :key="i"
        :cx="c.x"
        :cy="c.y"
        r="2.5"
        :fill="color ?? 'var(--accent)'"
      />
    </svg>
    <div class="chart__labels">
      <span v-if="coords.length">{{ coords[0].label }}</span>
      <span v-if="coords.length > 1">{{ coords[coords.length - 1].label }}</span>
    </div>
    <div v-if="coords.length" class="chart__range">{{ fmt(min) }} — {{ fmt(max) }}</div>
  </div>
</template>

<style scoped>
.chart__svg {
  width: 100%;
  display: block;
}

.chart__labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-soft);
  margin-top: 4px;
}

.chart__range {
  font-size: 11px;
  color: var(--text-soft);
  margin-top: 2px;
}
</style>
