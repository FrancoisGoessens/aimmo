<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  min: number;
  max: number;
  step: number;
  value: number;
  formatValue?: (n: number) => string;
}>();

const emit = defineEmits<{ update: [value: number] }>();

const fmt = computed(() => (props.formatValue ? props.formatValue(props.value) : String(props.value)));
const pct = computed(() => ((props.value - props.min) / (props.max - props.min)) * 100);

function onInput(e: Event) {
  emit("update", Number((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="slider">
    <div class="slider__value">{{ fmt }}</div>
    <div class="slider__track-wrap">
      <div class="slider__track"></div>
      <div class="slider__fill" :style="{ width: pct + '%' }"></div>
      <input type="range" class="slider__input" :min="min" :max="max" :step="step" :value="value" @input="onInput" />
    </div>
  </div>
</template>

<style scoped>
.slider__value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
}

.slider__track-wrap {
  position: relative;
  height: 22px;
}

.slider__track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  transform: translateY(-50%);
  background: var(--surface-2);
  border-radius: 2px;
}

.slider__fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 4px;
  transform: translateY(-50%);
  background: var(--accent);
  border-radius: 2px;
}

.slider__input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  margin: 0;
  height: 22px;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
}

.slider__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--surface);
  box-shadow: 0 0 0 1px var(--border);
  cursor: pointer;
  margin-top: 3px;
}

.slider__input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--surface);
  cursor: pointer;
}

.slider__input::-webkit-slider-runnable-track {
  background: transparent;
}
</style>
