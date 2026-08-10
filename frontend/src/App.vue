<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Sidebar from "./components/Sidebar.vue";
import Home from "./components/Home.vue";
import BulletinView from "./components/BulletinView.vue";
import SettingsView from "./components/SettingsView.vue";
import GenerateBulletinModal from "./components/GenerateBulletinModal.vue";
import type { Bulletin, Market, MarketCriteria, SourceGroup, LeboncoinConfig } from "./types";
import { THEMES, ORANGE_ACCENT, cssVars } from "./theme";

const theme = ref<"light" | "dark">("light");
const market = ref<Market>("achat");
const sourceGroup = ref<SourceGroup>("agences");
const view = ref<"home" | "bulletin" | "settings">("home");
const selectedId = ref<string | null>(null);
const mobileOpen = ref(false);
const isMobile = ref(false);
const comparisonDuration = ref("3m");
const showGenerateModal = ref(false);

const status = ref<"loading" | "ready" | "error">("loading");
// bulletins[sourceGroup][market]
const bulletinsData = ref<Record<SourceGroup, Record<Market, Bulletin[]>>>({
  agences: { achat: [], location: [] },
  leboncoin: { achat: [], location: [] },
});
const criteriaByMarket = ref<Record<Market, MarketCriteria> | null>(null);
const leboncoinConfig = ref<LeboncoinConfig | null>(null);

const rootStyle = computed(() => {
  const base = cssVars(THEMES[theme.value]);
  if (sourceGroup.value === "leboncoin") {
    const o = ORANGE_ACCENT[theme.value];
    return { ...base, "--accent": o.accent, "--accent-soft": o.accentSoft, "--accent-fg": o.accentFg };
  }
  return base;
});
const currentBulletins = computed(() => bulletinsData.value[sourceGroup.value][market.value]);
const selectedBulletin = computed(
  () => currentBulletins.value.find((b) => b.id === selectedId.value) ?? currentBulletins.value[0] ?? null
);
const currentCriteria = computed(() => criteriaByMarket.value?.[market.value] ?? null);

function checkMobile() {
  isMobile.value = window.innerWidth < 960;
}

async function loadBulletins(group: SourceGroup, m: Market): Promise<Bulletin[]> {
  const base = import.meta.env.BASE_URL;
  try {
    const indexRes = await fetch(`${base}data/bulletins/${group}/${m}/index.json`);
    if (!indexRes.ok) return [];
    const filenames: string[] = await indexRes.json();
    const results = await Promise.all(
      filenames.map(async (f) => {
        const res = await fetch(`${base}data/bulletins/${group}/${m}/${f}`);
        if (!res.ok) return null;
        return (await res.json()) as Bulletin;
      })
    );
    return results.filter((b): b is Bulletin => b !== null).sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

async function loadCriteria(m: Market): Promise<MarketCriteria | null> {
  const base = import.meta.env.BASE_URL;
  try {
    const res = await fetch(`${base}criteria-${m}.json`);
    if (!res.ok) return null;
    return (await res.json()) as MarketCriteria;
  } catch {
    return null;
  }
}

async function loadLeboncoinConfig(): Promise<LeboncoinConfig | null> {
  const base = import.meta.env.BASE_URL;
  try {
    const res = await fetch(`${base}leboncoin-config.json`);
    if (!res.ok) return null;
    return (await res.json()) as LeboncoinConfig;
  } catch {
    return null;
  }
}

onMounted(async () => {
  checkMobile();
  window.addEventListener("resize", checkMobile);

  try {
    const [agencesAchat, agencesLocation, lbcAchat, lbcLocation, achatC, locationC, lbcConfig] = await Promise.all([
      loadBulletins("agences", "achat"),
      loadBulletins("agences", "location"),
      loadBulletins("leboncoin", "achat"),
      loadBulletins("leboncoin", "location"),
      loadCriteria("achat"),
      loadCriteria("location"),
      loadLeboncoinConfig(),
    ]);
    bulletinsData.value = {
      agences: { achat: agencesAchat, location: agencesLocation },
      leboncoin: { achat: lbcAchat, location: lbcLocation },
    };
    if (achatC && locationC) criteriaByMarket.value = { achat: achatC, location: locationC };
    leboncoinConfig.value = lbcConfig;
    status.value = "ready";
  } catch {
    status.value = "error";
  }
});

function selectMarket(m: Market) {
  market.value = m;
  const list = bulletinsData.value[sourceGroup.value][m];
  selectedId.value = list.length ? list[0].id : null;
}

function selectSourceGroup(g: SourceGroup) {
  sourceGroup.value = g;
  const list = bulletinsData.value[g][market.value];
  selectedId.value = list.length ? list[0].id : null;
}

function selectBulletin(id: string) {
  selectedId.value = id;
  view.value = "bulletin";
}

function onSettingsSaved(c: MarketCriteria) {
  if (criteriaByMarket.value) criteriaByMarket.value[market.value] = c;
}

function onLeboncoinConfigSaved(c: LeboncoinConfig) {
  leboncoinConfig.value = c;
}

watch(theme, (t) => {
  document.documentElement.style.colorScheme = t;
});

const emptyCriteria: MarketCriteria = {
  zonesMinMinutes: 0,
  zonesMaxMinutes: 30,
  budgetMax: 0,
  surfaceMin: 0,
  etageMax: "",
  jardin: false,
  parking: false,
  dpeMin: "G",
  sources: [],
};
</script>

<template>
  <div class="root" :style="rootStyle">
    <div v-if="isMobile" class="mobile-topbar">
      <button class="mobile-menu-btn" @click="mobileOpen = !mobileOpen" aria-label="Ouvrir le menu">
        <span></span><span></span><span></span>
      </button>
      <div class="mobile-title">AImmo</div>
      <button class="mobile-theme-btn" @click="theme = theme === 'light' ? 'dark' : 'light'">
        {{ theme === "light" ? "☾" : "☀" }}
      </button>
    </div>

    <div class="shell" :style="{ minHeight: isMobile ? 'calc(100vh - 66px)' : '100vh' }">
      <Sidebar
        :bulletins="currentBulletins"
        :selected-id="selectedId"
        :market="market"
        :source-group="sourceGroup"
        :view="view"
        :mobile-open="mobileOpen"
        :is-mobile="isMobile"
        :theme="theme"
        @select-bulletin="selectBulletin"
        @select-market="selectMarket"
        @select-source-group="selectSourceGroup"
        @go-home="view = 'home'"
        @go-settings="view = 'settings'"
        @open-generate="showGenerateModal = true"
        @toggle-theme="theme = theme === 'light' ? 'dark' : 'light'"
        @close-mobile="mobileOpen = false"
      />

      <main class="main" :style="{ padding: isMobile ? '20px 16px 40px' : '32px 40px 60px' }">
        <p v-if="status === 'loading'" class="state">Chargement…</p>
        <p v-else-if="status === 'error'" class="state state--error">
          Impossible de charger les données. Vérifie que l'Action GitHub a tourné au moins une fois.
        </p>

        <template v-else>
          <SettingsView
            v-if="view === 'settings' && currentCriteria"
            :market="market"
            :criteria="currentCriteria"
            :leboncoin-config="leboncoinConfig"
            @saved="onSettingsSaved"
            @leboncoin-saved="onLeboncoinConfigSaved"
          />
          <BulletinView
            v-else-if="view === 'bulletin' && selectedBulletin"
            :selected="selectedBulletin"
            :market="market"
            :source-group="sourceGroup"
            :criteria="currentCriteria ?? emptyCriteria"
            @go-settings="view = 'settings'"
          />
          <Home
            v-else
            :bulletins="currentBulletins"
            :market="market"
            :source-group="sourceGroup"
            :comparison-duration="comparisonDuration"
            @change-duration="(d) => (comparisonDuration = d)"
            @change-market="selectMarket"
            @go-bulletin="selectBulletin"
          />
        </template>
      </main>
    </div>

    <GenerateBulletinModal
      v-if="showGenerateModal && currentCriteria"
      :criteria-achat="criteriaByMarket?.achat ?? emptyCriteria"
      :criteria-location="criteriaByMarket?.location ?? emptyCriteria"
      @close="showGenerateModal = false"
    />
  </div>
</template>

<style scoped>
.root {
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.mobile-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 20;
}

.mobile-menu-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.mobile-menu-btn span {
  width: 16px;
  height: 2px;
  background: var(--text);
  border-radius: 1px;
}

.mobile-title {
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.01em;
}

.mobile-theme-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 16px;
}

.shell {
  display: flex;
}

.main {
  flex: 1;
  min-width: 0;
}

.state {
  font-size: 13px;
  color: var(--text-soft);
  padding: 2rem 0;
}

.state--error {
  color: var(--danger);
}
</style>
