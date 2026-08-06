<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  sub?: string | null;
  valueColor?: string;
  subColor?: string;
}>();
</script>

<template>
  <div class="stat-card">
    <div class="stat-card__label">{{ label }}</div>
    <div class="stat-card__value" :style="valueColor ? { color: valueColor } : {}">{{ value }}</div>
    <div v-if="sub" class="stat-card__sub" :style="subColor ? { color: subColor } : {}">{{ sub }}</div>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px 18px;
}

.stat-card__label {
  font-size: 12px;
  color: var(--text-soft);
  font-weight: 600;
  margin-bottom: 8px;
}

.stat-card__value {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text);
}

.stat-card__sub {
  font-size: 12px;
  font-weight: 700;
  margin-top: 6px;
  color: var(--text-soft);
}
</style>
