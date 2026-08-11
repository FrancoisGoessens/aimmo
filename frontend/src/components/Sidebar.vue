<script setup lang="ts">
import { ref, computed } from "vue";
import type { Bulletin, Market } from "../types";
import { buildSidebarGroups, fmtDate } from "../utils";

const props = defineProps<{
  bulletins: Bulletin[];
  selectedId: string | null;
  market: Market;
  sourceGroup: "agences" | "leboncoin";
  view: "home" | "bulletin" | "settings";
  mobileOpen: boolean;
  isMobile: boolean;
  theme: "light" | "dark";
}>();

const emit = defineEmits<{
  selectBulletin: [id: string];
  selectMarket: [market: Market];
  selectSourceGroup: [group: "agences" | "leboncoin"];
  goHome: [];
  goSettings: [];
  openGenerate: [];
  toggleTheme: [];
  closeMobile: [];
}>();

const expanded = ref<Record<string, boolean>>({});
const showDemo = ref(false);
const now = new Date();

const sidebar = computed(() => buildSidebarGroups(props.bulletins, now));

const DEMO: Bulletin[] = [
  {
    id: "demo-1",
    market: "achat",
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
    source: "auto",
    avgPricePerM2: 2340,
    avgPrice: 195000,
    totalAnalyzed: 47,
    bestScore: 8.9,
    top10: [],
  },
  {
    id: "demo-2",
    market: "achat",
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2).toISOString(),
    source: "manual",
    avgPricePerM2: 2310,
    avgPrice: 192000,
    totalAnalyzed: 41,
    bestScore: 8.4,
    top10: [],
  },
];

function toggleGroup(key: string) {
  expanded.value[key] = !expanded.value[key];
}

function pick(id: string) {
  emit("selectBulletin", id);
  emit("closeMobile");
}

function dotClasses(b: Bulletin) {
  return {
    "nav-item__dot--active": b.id === props.selectedId,
    "nav-item__dot--manual": b.source === "manual",
  };
}
</script>

<template>
  <div v-if="isMobile && mobileOpen" class="backdrop" @click="emit('closeMobile')"></div>

  <aside class="sidebar" :class="{ 'sidebar--mobile': isMobile, 'sidebar--open': mobileOpen }">
    <div class="sidebar__header">
      <div>
        <div class="sidebar__title">AImmo</div>
        <div class="sidebar__subtitle">Recherche · Côte d'Opale</div>
      </div>
      <div class="group-switch" role="group" aria-label="Source">
        <button
          class="group-switch__btn"
          :class="{ 'group-switch__btn--active': sourceGroup === 'agences' }"
          title="Agences"
          @click="emit('selectSourceGroup', 'agences')"
        >
          Ag
        </button>
        <button
          class="group-switch__btn"
          :class="{ 'group-switch__btn--active': sourceGroup === 'leboncoin' }"
          title="Leboncoin"
          @click="emit('selectSourceGroup', 'leboncoin')"
        >
          Lbc
        </button>
      </div>
    </div>

    <nav class="sidebar__top-nav">
      <button
        class="nav-item"
        :class="{ 'nav-item--active': view === 'home' }"
        @click="
          emit('goHome');
          emit('closeMobile');
        "
      >
        <svg class="home-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
        </svg>
        Accueil
      </button>
      <button class="nav-item nav-item--generate" @click="emit('openGenerate')">
        <span class="plus-icon">+</span>
        Générer un bulletin
      </button>
    </nav>

    <div class="sidebar__market">
      <div class="market-toggle">
        <button
          class="market-toggle__btn"
          :class="{ 'market-toggle__btn--active': market === 'achat' }"
          @click="emit('selectMarket', 'achat')"
        >
          Achat
        </button>
        <button
          class="market-toggle__btn"
          :class="{ 'market-toggle__btn--active': market === 'location' }"
          @click="emit('selectMarket', 'location')"
        >
          Location
        </button>
      </div>
    </div>

    <nav class="sidebar__nav">
      <div class="sidebar__section-label">Bulletins</div>

      <div v-if="bulletins.length === 0 && !showDemo" class="sidebar__empty">
        <p class="sidebar__empty-text">
          Aucun bulletin pour l'instant.<br />Ton premier bulletin arrive au prochain passage planifié (lundi ou
          mercredi), ou clique "Générer un bulletin" ci-dessus.
        </p>
        <button class="demo-btn" @click="showDemo = true">Aperçu exemple</button>
      </div>

      <template v-else-if="bulletins.length === 0 && showDemo">
        <div class="demo-banner">
          Exemple — pas de vraies données
          <button class="demo-btn demo-btn--inline" @click="showDemo = false">Revenir</button>
        </div>
        <button v-for="b in DEMO" :key="b.id" class="nav-item nav-item--demo" disabled>
          <span class="nav-item__dot" :class="dotClasses(b)"></span>
          <span class="nav-item__label">{{ fmtDate(b.date) }}</span>
        </button>
      </template>

      <template v-else>
        <button
          v-for="b in sidebar.recent"
          :key="b.id"
          class="nav-item"
          :class="{ 'nav-item--active': b.id === selectedId }"
          @click="pick(b.id)"
        >
          <span class="nav-item__dot" :class="dotClasses(b)"></span>
          <span class="nav-item__label">{{ fmtDate(b.date) }}</span>
        </button>

        <div v-for="g in sidebar.groups" :key="g.key" class="nav-group">
          <button class="nav-group__toggle" @click="toggleGroup(g.key)">
            <span class="nav-group__arrow">{{ expanded[g.key] ? "▾" : "▸" }}</span>
            <span class="nav-group__label">{{ g.label }}</span>
            <span class="nav-group__count">{{ g.items.length }}</span>
          </button>
          <div v-if="expanded[g.key]" class="nav-group__items">
            <button
              v-for="b in g.items"
              :key="b.id"
              class="nav-item"
              :class="{ 'nav-item--active': b.id === selectedId }"
              @click="pick(b.id)"
            >
              <span class="nav-item__dot" :class="dotClasses(b)"></span>
              <span class="nav-item__label">{{ fmtDate(b.date) }}</span>
            </button>
          </div>
        </div>
      </template>
    </nav>

    <div class="sidebar__footer">
      <div class="legend">
        <span class="legend__dot legend__dot--auto"></span> Auto
        <span class="legend__dot legend__dot--manual"></span> Manuel
      </div>
      <button class="nav-item" :class="{ 'nav-item--active': view === 'settings' }" @click="emit('goSettings')">
        <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Paramètres
      </button>
      <button v-if="!isMobile" class="nav-item" @click="emit('toggleTheme')">
        <span>{{ theme === "light" ? "☾" : "☀" }}</span>
        <span>{{ theme === "light" ? "Mode sombre" : "Mode clair" }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: oklch(0% 0 0 / 0.45);
  z-index: 29;
}

.sidebar {
  width: 280px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
}

.sidebar--mobile {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 30;
  transform: translateX(-100%);
  transition: transform 0.2s ease;
}

.sidebar--mobile.sidebar--open {
  transform: translateX(0);
}

.sidebar__header {
  padding: 18px 18px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.group-switch {
  display: flex;
  background: var(--surface-2);
  border-radius: 7px;
  padding: 2px;
  gap: 1px;
  flex-shrink: 0;
}

.group-switch__btn {
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-size: 10px;
  font-weight: 800;
  padding: 4px 7px;
  border-radius: 5px;
  letter-spacing: 0.02em;
}

.group-switch__btn--active {
  background: var(--accent);
  color: var(--accent-fg);
}

.sidebar__title {
  font-weight: 800;
  font-size: 18px;
  letter-spacing: -0.02em;
  color: var(--text);
}

.sidebar__subtitle {
  font-size: 12px;
  color: var(--text-soft);
  margin-top: 3px;
}

.sidebar__top-nav {
  padding: 12px 12px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar__market {
  padding: 12px 18px 0;
}

.market-toggle {
  display: flex;
  background: var(--surface-2);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
}

.market-toggle--group {
  margin-bottom: 8px;
}

.market-toggle__btn {
  flex: 1;
  padding: 7px 0;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 700;
  background: transparent;
  color: var(--text-soft);
}

.market-toggle__btn--active {
  background: var(--accent);
  color: var(--accent-fg);
}

.sidebar__nav {
  flex: 1;
  overflow-y: auto;
  padding: 18px 12px 12px;
}

.sidebar__section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-soft);
  text-transform: uppercase;
  padding: 0 8px 8px;
}

.sidebar__empty {
  padding: 10px;
  text-align: center;
}

.sidebar__empty-text {
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 12px;
}

.demo-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 7px;
}

.demo-btn--inline {
  padding: 3px 8px;
  font-size: 11px;
}

.demo-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-soft);
  padding: 6px 8px;
  margin-bottom: 6px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  text-align: left;
}

.nav-item--active {
  background: var(--accent-soft);
  color: var(--accent);
}

.nav-item--generate {
  color: var(--accent);
}

.nav-item--demo {
  opacity: 0.55;
  cursor: default;
}

.plus-icon {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 13px;
}

.home-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid currentColor;
  display: inline-block;
}

.nav-item__dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  flex-shrink: 0;
}

.nav-item__dot--active {
  background: var(--accent);
}

.nav-item__dot--manual {
  box-shadow: 0 0 0 2px var(--success-soft);
  background: var(--success);
}

.nav-item__dot--manual.nav-item__dot--active {
  background: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.nav-item__label {
  flex: 1;
  text-align: left;
}

.nav-group {
  margin-top: 2px;
}

.nav-group__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 600;
}

.nav-group__arrow {
  width: 12px;
  font-size: 10px;
}

.nav-group__label {
  flex: 1;
  text-align: left;
}

.nav-group__count {
  font-size: 11px;
  background: var(--surface-2);
  border-radius: 6px;
  padding: 2px 6px;
}

.nav-group__items {
  padding-left: 14px;
}

.sidebar__footer {
  border-top: 1px solid var(--border);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-soft);
  padding: 0 10px 6px;
}

.legend__dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  margin-left: 6px;
}

.legend__dot--auto {
  background: var(--border);
  margin-left: 0;
}

.legend__dot--manual {
  background: var(--success);
}

.home-icon,
.settings-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
</style>
