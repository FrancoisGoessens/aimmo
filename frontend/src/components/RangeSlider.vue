<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  formatValue?: (n: number) => string;
}>();

const emit = defineEmits<{ update: [low: number, high: number] }>();

const fmt = (n: number) => (props.formatValue ? props.formatValue(n) : String(n));

const lowPct = computed(() => ((props.low - props.min) / (props.max - props.min)) * 100);
const highPct = computed(() => ((props.high - props.min) / (props.max - props.min)) * 100);

function onLowInput(e: Event) {
  const v = Math.min(Number((e.target as HTMLInputElement).value), props.high);
  emit("update", v, props.high);
}
function onHighInput(e: Event) {
  const v = Math.max(Number((e.target as HTMLInputElement).value), props.low);
  emit("update", props.low, v);
}
</script>

<template>
  <div class="range">
    <div class="range__labels">
      <span>{{ fmt(low) }}</span>
      <span>{{ fmt(high) }}</span>
    </div>
    <div class="range__track-wrap">
      <div class="range__track"></div>
      <div class="range__fill" :style="{ left: lowPct + '%', width: highPct - lowPct + '%' }"></div>
      <input
        type="range"
        class="range__input"
        :min="min"
        :max="max"
        :step="step"
        :value="low"
        @input="onLowInput"
      />
      <input
        type="range"
        class="range__input"
        :min="min"
        :max="max"
        :step="step"
        :value="high"
        @input="onHighInput"
      />
    </div>
  </div>
</template>

<style scoped>
.range__labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
}

.range__track-wrap {
  position: relative;
  height: 22px;
}

.range__track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  transform: translateY(-50%);
  background: var(--surface-2);
  border-radius: 2px;
}

.range__fill {
  position: absolute;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  background: var(--accent);
  border-radius: 2px;
}

.range__input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  margin: 0;
  height: 22px;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  pointer-events: none;
}

.range__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  pointer-events: auto;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--surface);
  box-shadow: 0 0 0 1px var(--border);
  cursor: pointer;
  margin-top: 3px;
}

.range__input::-moz-range-thumb {
  pointer-events: auto;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--surface);
  cursor: pointer;
}

.range__input::-webkit-slider-runnable-track {
  background: transparent;
}
</style>
