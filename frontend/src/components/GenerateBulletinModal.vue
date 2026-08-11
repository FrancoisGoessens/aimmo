<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { Market, MarketCriteria } from "../types";
import { triggerWorkflow, isConfigured } from "../github";
import { THEMES, ORANGE_ACCENT, cssVars } from "../theme";

const props = defineProps<{
  criteriaAchat: MarketCriteria;
  criteriaLocation: MarketCriteria;
  theme: "light" | "dark";
}>();

const emit = defineEmits<{ close: [] }>();

const market = ref<Market>("achat");
const group = ref<"agences" | "leboncoin">("agences");
const overrideBudget = ref<number>(props.criteriaAchat.budgetMax);
const status = ref<"idle" | "sending" | "sent" | "error">("idle");
const errorMsg = ref("");

const modalStyle = computed(() => {
  const base = cssVars(THEMES[props.theme]);
  if (group.value === "leboncoin") {
    const o = ORANGE_ACCENT[props.theme];
    return { ...base, "--accent": o.accent, "--accent-soft": o.accentSoft, "--accent-fg": o.accentFg };
  }
  return base;
});

watch(market, (m) => {
  overrideBudget.value = m === "achat" ? props.criteriaAchat.budgetMax : props.criteriaLocation.budgetMax;
});

async function launch() {
  if (!isConfigured()) {
    status.value = "error";
    errorMsg.value = "Configure d'abord ton token GitHub dans Paramètres.";
    return;
  }
  status.value = "sending";
  errorMsg.value = "";
  try {
    const workflowFile = group.value === "agences" ? "scrape-and-deploy.yml" : "scrape-leboncoin.yml";
    await triggerWorkflow(workflowFile, {
      market: market.value,
      budget_override: String(overrideBudget.value),
    });
    status.value = "sent";
  } catch (e) {
    status.value = "error";
    errorMsg.value = e instanceof Error ? e.message : "Erreur inconnue";
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal" :style="modalStyle">
      <div class="modal__title">Générer un bulletin maintenant</div>
      <p class="modal__hint">
        Lance un relevé ponctuel, en plus du rythme automatique lundi/mercredi. Il apparaîtra dans la sidebar avec
        une pastille distincte des bulletins automatiques.
      </p>

      <div class="field">
        <label class="field-label">Source</label>
        <div class="toggle-group">
          <button class="toggle-group__btn" :class="{ 'toggle-group__btn--active': group === 'agences' }" @click="group = 'agences'">
            Agences
          </button>
          <button class="toggle-group__btn" :class="{ 'toggle-group__btn--active': group === 'leboncoin' }" @click="group = 'leboncoin'">
            Leboncoin
          </button>
        </div>
      </div>

      <div class="field">
        <label class="field-label">Marché</label>
        <div class="toggle-group">
          <button class="toggle-group__btn" :class="{ 'toggle-group__btn--active': market === 'achat' }" @click="market = 'achat'">
            Achat
          </button>
          <button class="toggle-group__btn" :class="{ 'toggle-group__btn--active': market === 'location' }" @click="market = 'location'">
            Location
          </button>
        </div>
      </div>

      <div class="field">
        <label class="field-label">Budget max pour ce run (ne modifie pas tes critères enregistrés)</label>
        <input type="number" class="field-input" v-model.number="overrideBudget" />
      </div>

      <p v-if="status === 'error'" class="modal__error">{{ errorMsg }}</p>
      <p v-if="status === 'sent'" class="modal__success">
        Lancé. Le bulletin apparaîtra dans quelques minutes (le temps que l'Action GitHub tourne).
      </p>

      <div class="modal__actions">
        <button class="btn btn--ghost" @click="emit('close')">Fermer</button>
        <button class="btn btn--primary" :disabled="status === 'sending'" @click="launch">
          {{ status === "sending" ? "Lancement…" : "Lancer" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: oklch(0% 0 0 / 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  max-width: 420px;
  width: 100%;
}

.modal__title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
  margin-bottom: 8px;
}

.modal__hint {
  font-size: 13px;
  color: var(--text-soft);
  margin: 0 0 18px;
  line-height: 1.5;
}

.field {
  margin-bottom: 16px;
}

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-soft);
  margin-bottom: 6px;
}

.field-input {
  width: 100%;
  padding: 9px 11px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
}

.toggle-group {
  display: flex;
  background: var(--surface-2);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
}

.toggle-group__btn {
  flex: 1;
  padding: 7px 0;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 700;
  background: transparent;
  color: var(--text-soft);
}

.toggle-group__btn--active {
  background: var(--accent);
  color: var(--accent-fg);
}

.modal__error {
  font-size: 12px;
  color: var(--danger);
  margin: 0 0 12px;
}

.modal__success {
  font-size: 12px;
  color: var(--success);
  margin: 0 0 12px;
}

.modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.btn {
  padding: 9px 16px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid var(--border);
}

.btn--ghost {
  background: transparent;
  color: var(--text-soft);
}

.btn--primary {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: transparent;
}

.btn--primary:disabled {
  opacity: 0.6;
}
</style>
