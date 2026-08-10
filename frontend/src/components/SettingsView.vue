<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import type { Market, MarketCriteria, CommuneTemps, LeboncoinConfig } from "../types";
import { fmtMoney } from "../utils";
import RangeSlider from "./RangeSlider.vue";
import Slider from "./Slider.vue";
import { getToken, setToken, getRepo, setRepo, isConfigured, commitFile } from "../github";

const props = defineProps<{ market: Market; criteria: MarketCriteria; leboncoinConfig: LeboncoinConfig | null }>();
const emit = defineEmits<{ saved: [criteria: MarketCriteria]; leboncoinSaved: [config: LeboncoinConfig] }>();

const AGENCY_SOURCES = [
  { id: "orpi", label: "Orpi" },
  { id: "fnaim", label: "FNAIM.fr" },
  { id: "square-habitat", label: "Square Habitat" },
];

const form = ref<MarketCriteria>({ ...props.criteria, sources: props.criteria.sources ?? [] });
const lbcForm = ref<LeboncoinConfig>(
  props.leboncoinConfig ?? {
    achat: { enabled: false, autoWeekly: false },
    location: { enabled: false, autoWeekly: false },
  }
);
const communes = ref<CommuneTemps[]>([]);
const status = ref<"idle" | "saving" | "saved" | "error">("idle");
const lbcStatus = ref<"idle" | "saving" | "saved" | "error">("idle");
const errorMsg = ref("");

const tokenInput = ref(getToken() ?? "");
const repoInput = ref(getRepo() ?? "");

watch(
  () => props.criteria,
  (c) => (form.value = { ...c, sources: c.sources ?? [] })
);

onMounted(async () => {
  try {
    const base = import.meta.env.BASE_URL;
    const res = await fetch(`${base}data/communes-temps.json`);
    if (res.ok) {
      const data = await res.json();
      communes.value = data.communes ?? [];
    }
  } catch {
    // pas grave, la liste de zones sera juste vide
  }
});

const budgetBounds = computed(() =>
  props.market === "achat" ? { min: 50000, max: 500000, step: 5000 } : { min: 300, max: 2000, step: 10 }
);

const resolvedZones = computed(() =>
  communes.value
    .filter((c) => c.minutes >= form.value.zonesMinMinutes && c.minutes <= form.value.zonesMaxMinutes)
    .sort((a, b) => a.minutes - b.minutes)
);

function update<K extends keyof MarketCriteria>(key: K, value: MarketCriteria[K]) {
  form.value = { ...form.value, [key]: value };
}

function toggleSource(id: string) {
  const has = form.value.sources.includes(id);
  update("sources", has ? form.value.sources.filter((s) => s !== id) : [...form.value.sources, id]);
}

function saveGithubConfig() {
  setToken(tokenInput.value.trim());
  setRepo(repoInput.value.trim());
}

async function confirm() {
  saveGithubConfig();
  if (!isConfigured()) {
    status.value = "error";
    errorMsg.value = "Renseigne ton token et ton repo GitHub ci-dessus avant de confirmer.";
    return;
  }
  status.value = "saving";
  errorMsg.value = "";
  try {
    const path = `frontend/public/criteria-${props.market}.json`;
    await commitFile(path, JSON.stringify(form.value, null, 2), `Mise à jour critères ${props.market}`);
    status.value = "saved";
    emit("saved", form.value);
    setTimeout(() => (status.value = "idle"), 2000);
  } catch (e) {
    status.value = "error";
    errorMsg.value = e instanceof Error ? e.message : "Erreur inconnue";
  }
}

async function confirmLeboncoin() {
  saveGithubConfig();
  if (!isConfigured()) {
    lbcStatus.value = "error";
    return;
  }
  lbcStatus.value = "saving";
  try {
    await commitFile(
      "frontend/public/leboncoin-config.json",
      JSON.stringify(lbcForm.value, null, 2),
      "Mise à jour config Leboncoin"
    );
    lbcStatus.value = "saved";
    emit("leboncoinSaved", lbcForm.value);
    setTimeout(() => (lbcStatus.value = "idle"), 2000);
  } catch {
    lbcStatus.value = "error";
  }
}
</script>

<template>
  <div class="settings">
    <div class="settings__header">
      <div class="settings__title">Paramètres</div>
      <div class="settings__subtitle">Critères de recherche — {{ market === "achat" ? "Achat" : "Location" }}</div>
    </div>

    <div class="settings__card">
      <div>
        <label class="field-label">
          Zones ciblées — temps de trajet vers Calais Fréthun (sans autoroute payante)
        </label>
        <RangeSlider
          :min="0"
          :max="30"
          :step="1"
          :low="form.zonesMinMinutes"
          :high="form.zonesMaxMinutes"
          :format-value="(n) => n + ' min'"
          @update="(lo, hi) => { update('zonesMinMinutes', lo); update('zonesMaxMinutes', hi); }"
        />
        <div class="zones-result">
          <span v-if="resolvedZones.length === 0" class="zones-result__empty">Aucune commune dans cet intervalle.</span>
          <span v-for="c in resolvedZones" :key="c.name" class="zone-chip">{{ c.name }} · {{ c.minutes }} min</span>
        </div>
      </div>

      <div>
        <label class="field-label">Budget max</label>
        <Slider
          :min="budgetBounds.min"
          :max="budgetBounds.max"
          :step="budgetBounds.step"
          :value="form.budgetMax"
          :format-value="(n) => (market === 'achat' ? fmtMoney(n) : fmtMoney(n) + '/mois')"
          @update="(v) => update('budgetMax', v)"
        />
      </div>

      <div class="field-row">
        <div>
          <label class="field-label">Surface min (m²)</label>
          <input
            type="number"
            class="field-input"
            :value="form.surfaceMin"
            @input="update('surfaceMin', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div>
          <label class="field-label">{{ market === "location" ? "Étage maximum" : "Étage souhaité" }}</label>
          <input
            v-if="market === 'location'"
            type="number"
            min="0"
            class="field-input"
            :value="form.etageMax"
            @input="update('etageMax', Number(($event.target as HTMLInputElement).value))"
          />
          <input
            v-else
            type="text"
            class="field-input"
            :value="form.etageMax"
            @input="update('etageMax', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="field-row">
        <div>
          <label class="field-label">DPE minimum</label>
          <select class="field-input" :value="form.dpeMin" @change="update('dpeMin', ($event.target as HTMLSelectElement).value)">
            <option v-for="l in ['A', 'B', 'C', 'D', 'E', 'F', 'G']" :key="l" :value="l">{{ l }}</option>
          </select>
        </div>
        <div class="field-row field-row--toggles">
          <button class="toggle-btn" :class="{ 'toggle-btn--active': form.jardin }" @click="update('jardin', !form.jardin)">
            Jardin requis
          </button>
          <button class="toggle-btn" :class="{ 'toggle-btn--active': form.parking }" @click="update('parking', !form.parking)">
            Parking requis
          </button>
        </div>
      </div>

      <div>
        <label class="field-label">Sites agences interrogés</label>
        <div class="sources-checks">
          <button
            v-for="s in AGENCY_SOURCES"
            :key="s.id"
            class="toggle-btn"
            :class="{ 'toggle-btn--active': form.sources.includes(s.id) }"
            @click="toggleSource(s.id)"
          >
            {{ s.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="settings__card">
      <div class="settings__card-title">Leboncoin</div>
      <p class="settings__card-hint">
        Séparé des sites agences (source plus fragile) — jamais scrappé automatiquement sauf si tu actives
        l'option hebdomadaire.
      </p>
      <div class="field-row">
        <div class="lbc-block">
          <div class="lbc-block__title">Achat</div>
          <button
            class="toggle-btn"
            :class="{ 'toggle-btn--active': lbcForm.achat.enabled }"
            @click="lbcForm.achat.enabled = !lbcForm.achat.enabled"
          >
            Activé
          </button>
          <button
            class="toggle-btn"
            :class="{ 'toggle-btn--active': lbcForm.achat.autoWeekly }"
            @click="lbcForm.achat.autoWeekly = !lbcForm.achat.autoWeekly"
          >
            Auto 1x/semaine
          </button>
        </div>
        <div class="lbc-block">
          <div class="lbc-block__title">Location</div>
          <button
            class="toggle-btn"
            :class="{ 'toggle-btn--active': lbcForm.location.enabled }"
            @click="lbcForm.location.enabled = !lbcForm.location.enabled"
          >
            Activé
          </button>
          <button
            class="toggle-btn"
            :class="{ 'toggle-btn--active': lbcForm.location.autoWeekly }"
            @click="lbcForm.location.autoWeekly = !lbcForm.location.autoWeekly"
          >
            Auto 1x/semaine
          </button>
        </div>
      </div>
      <button class="confirm-btn confirm-btn--secondary" :disabled="lbcStatus === 'saving'" @click="confirmLeboncoin">
        {{ lbcStatus === "saving" ? "Enregistrement…" : lbcStatus === "saved" ? "Enregistré ✓" : "Confirmer Leboncoin" }}
      </button>
    </div>

    <div class="settings__card settings__card--github">
      <div class="settings__card-title">Connexion GitHub (pour confirmer sans push manuel)</div>
      <p class="settings__card-hint">
        Token personnel scopé à ce repo uniquement (permissions Contents + Actions en lecture/écriture). Reste
        stocké uniquement dans ce navigateur.
      </p>
      <div class="field">
        <label class="field-label">Repo (format utilisateur/repo)</label>
        <input type="text" class="field-input" v-model="repoInput" placeholder="tonuser/aimmo" />
      </div>
      <div class="field">
        <label class="field-label">Token GitHub</label>
        <input type="password" class="field-input" v-model="tokenInput" placeholder="github_pat_..." />
      </div>
    </div>

    <p v-if="status === 'error'" class="feedback feedback--error">{{ errorMsg }}</p>
    <p v-if="status === 'saved'" class="feedback feedback--success">Critères enregistrés dans le repo.</p>

    <button class="confirm-btn" :disabled="status === 'saving'" @click="confirm">
      {{ status === "saving" ? "Enregistrement…" : "Confirmer les paramètres" }}
    </button>
  </div>
</template>

<style scoped>
.settings {
  max-width: 640px;
}

.settings__header {
  margin-bottom: 22px;
}

.settings__title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text);
}

.settings__subtitle {
  font-size: 13px;
  color: var(--text-soft);
  margin-top: 4px;
}

.settings__card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 16px;
}

.settings__card--github {
  gap: 12px;
}

.settings__card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.settings__card-hint {
  font-size: 12px;
  color: var(--text-soft);
  margin: 0 0 4px;
  line-height: 1.5;
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

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field-row--toggles {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.field {
  margin-bottom: 0;
}

.toggle-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 700;
  height: 38px;
}

.toggle-btn--active {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: transparent;
}

.zones-result {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.zones-result__empty {
  font-size: 12px;
  color: var(--text-soft);
}

.zone-chip {
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
}

.feedback {
  font-size: 12px;
  margin: 0 0 10px;
}

.feedback--error {
  color: var(--danger);
}

.feedback--success {
  color: var(--success);
}

.confirm-btn {
  width: 100%;
  padding: 12px 0;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: var(--accent-fg);
  font-size: 14px;
  font-weight: 800;
}

.confirm-btn:disabled {
  opacity: 0.6;
}

.confirm-btn--secondary {
  background: var(--surface-2);
  color: var(--text);
  margin-top: 4px;
}

.sources-checks {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.lbc-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lbc-block__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-soft);
}
</style>
