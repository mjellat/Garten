<template>
  <div class="app-shell">
    <header class="app-topbar">
      <div class="container-xxl py-4">
        <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-4">
          <div class="brand-lockup">
            <div class="brand-mark"><i :class="`bi ${UI_ICONS.brand}`" aria-hidden="true"></i></div>
            <div>
              <p class="eyebrow mb-1">Saisonplanung</p>
              <h1 class="brand-title mb-1">Garten Saison Planer</h1>
              <p class="brand-copy mb-0">Aussaat, Anzucht, Ernte und Düngung in einem klaren Jahresplan.</p>
            </div>
          </div>

          <div class="topbar-actions">
            <div class="toolbar-panel">
              <span class="toolbar-label">Planjahr</span>
              <div class="btn-group year-controls" role="group" aria-label="Jahr wählen">
                <button class="btn btn-light" type="button" @click="year--" aria-label="Vorjahr"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
                <input id="year-sel" class="form-control year-input" type="number" v-model.number="year" min="2024" max="2040" />
                <button class="btn btn-light" type="button" @click="year++" aria-label="Nächstes Jahr"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
              </div>
            </div>

            <div class="account-panel">
              <template v-if="isAuthenticated">
                <div class="account-meta">
                  <span class="toolbar-label">{{ user.email }}</span>
                  <span class="sync-pill" :class="`sync-${syncStatus}`">{{ syncMessage }}</span>
                </div>
                <div class="account-actions">
                  <button class="btn btn-light btn-sm" type="button" :disabled="authLoading" @click="syncCurrentPlan()">Jetzt syncen</button>
                  <button class="btn btn-outline-light btn-sm" type="button" :disabled="authLoading" @click="logout()">Abmelden</button>
                </div>
              </template>

              <form v-else class="auth-form" @submit.prevent="submitLogin">
                <input v-model.trim="authEmail" class="form-control form-control-sm" type="email" placeholder="E-Mail" autocomplete="email" required />
                <input v-model="authPassword" class="form-control form-control-sm" type="password" placeholder="Passwort" autocomplete="current-password" required />
                <button class="btn btn-light btn-sm" type="submit" :disabled="authLoading">Anmelden</button>
                <button class="btn btn-outline-light btn-sm" type="button" :disabled="authLoading" @click="submitRegister">Registrieren</button>
                <span v-if="authError" class="auth-error">{{ authError }}</span>
              </form>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="container-xxl app-main">
      <section class="dashboard-strip">
        <div class="row g-3">
          <div class="col-12 col-md-4">
            <div class="metric-tile">
              <span class="metric-label">Pflanzen im Plan</span>
              <strong>{{ selectedEntries.length }}</strong>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="metric-tile">
              <span class="metric-label">Düngetermine</span>
              <strong>{{ fertilizationCount }}</strong>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="metric-tile">
              <span class="metric-label">Aktiver Bereich</span>
              <strong>{{ currentTabLabel }}</strong>
            </div>
          </div>
        </div>
      </section>

      <div v-if="hasSyncConflict" class="conflict-alert alert alert-warning">
        <strong>Sync-Konflikt:</strong> Dieser Plan wurde auf einem anderen Gerät geändert.
        <div class="conflict-actions">
          <button class="btn btn-sm btn-warning" type="button" @click="keepLocalConflictPlan">Lokalen Plan behalten</button>
          <button class="btn btn-sm btn-outline-dark" type="button" @click="useRemoteConflictPlan">Serverstand übernehmen</button>
        </div>
      </div>

      <nav class="nav nav-pills app-tabs" aria-label="Planbereiche">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="nav-link"
          :class="{ active: activeTab === tab.id }"
          type="button"
          @click="activeTab = tab.id"
        >
          <i :class="`bi ${tab.icon}`" aria-hidden="true"></i>
          <span>{{ tab.label }}</span>
          <span v-if="tab.id === 'plan' && selectedEntries.length > 0" class="badge rounded-pill text-bg-light">{{ selectedEntries.length }}</span>
        </button>
      </nav>

      <div v-show="activeTab === 'plan'" class="tab-content">
        <div class="row g-4 align-items-start">
          <section class="col-12 col-lg-4">
            <div class="workspace-panel">
              <div class="section-heading">
                <p class="eyebrow mb-1">Auswahl</p>
                <h2>Pflanzen auswählen</h2>
                <p>Klicke auf eine Pflanze, um sie zum Saisonplan hinzuzufügen.</p>
              </div>
              <PlantSelector v-model="selectedEntries" />
            </div>
          </section>

          <section class="col-12 col-lg-8">
            <div class="workspace-panel">
              <div class="section-heading">
                <p class="eyebrow mb-1">Termine</p>
                <h2>Plan feinjustieren</h2>
                <p>Lasse ideale Termine errechnen oder setze deinen eigenen Aussaattermin.</p>
              </div>
              <DateInputPanel v-model="selectedEntries" :year="year" />
            </div>
          </section>
        </div>
      </div>

      <div v-show="activeTab === 'timeline'" class="tab-content">
        <section class="workspace-panel">
          <div class="section-heading">
            <p class="eyebrow mb-1">Zeitachse</p>
            <h2>Visueller Jahresplan {{ year }}</h2>
            <p>Hover über die Marker für Düngungsdetails. Die rote Linie zeigt heute.</p>
          </div>
          <GardenTimeline :schedules="schedules" :year="year" />
        </section>
      </div>

      <div v-show="activeTab === 'fert'" class="tab-content">
        <section class="workspace-panel">
          <div class="section-heading">
            <p class="eyebrow mb-1">Nährstoffe</p>
            <h2>Düngekalender {{ year }}</h2>
            <p>Alle Düngegaben chronologisch geordnet mit Menge und Beschreibung.</p>
          </div>
          <FertilizationSchedule :schedules="schedules" :year="year" />
        </section>
      </div>

      <div v-show="activeTab === 'export'" class="tab-content">
        <section class="workspace-panel">
          <div class="section-heading">
            <p class="eyebrow mb-1">Ausgabe</p>
            <h2>Export & Druck</h2>
            <p>Exportiere deinen Gartenplan als Kalender-Datei oder drucke ihn aus.</p>
          </div>
          <ExportPanel :schedules="schedules" :year="year" />
        </section>
      </div>

      <div v-if="selectedEntries.length === 0" class="empty-guidance alert alert-success">
        <strong>Startpunkt:</strong> Wähle im Bereich Planung deine ersten Pflanzen aus.
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PlantSelector from './components/PlantSelector.vue'
import DateInputPanel from './components/DateInputPanel.vue'
import GardenTimeline from './components/GardenTimeline.vue'
import FertilizationSchedule from './components/FertilizationSchedule.vue'
import ExportPanel from './components/ExportPanel.vue'
import { plants } from './data/plants.js'
import { calculateSchedule } from './utils/dates.js'
import { UI_ICONS } from './utils/icons.js'
import {
  authLoading,
  hasSyncConflict,
  initializeSession,
  isAuthenticated,
  keepLocalConflictPlan,
  login as loginAccount,
  logout,
  register as registerAccount,
  selectedEntries,
  syncCurrentPlan,
  syncMessage,
  syncStatus,
  useRemoteConflictPlan,
  user,
  year,
} from './stores/gardenPlanStore.js'

const activeTab = ref('plan')
const authEmail = ref('')
const authPassword = ref('')
const authError = ref('')

const tabs = [
  { id: 'plan',     icon: UI_ICONS.planning,      label: 'Planung'    },
  { id: 'timeline', icon: UI_ICONS.timeline,      label: 'Zeitplan'   },
  { id: 'fert',     icon: UI_ICONS.fertilization, label: 'Düngeplan'  },
  { id: 'export',   icon: UI_ICONS.export,        label: 'Export'     },
]

const schedules = computed(() =>
  selectedEntries.value.map(entry => {
    const plant   = plants.find(p => p.id === entry.plantId)
    const variety = entry.varietyId
      ? plant.varieties?.find(v => v.id === entry.varietyId) ?? null
      : null
    return {
      ...calculateSchedule(plant, year.value, entry.actualSowingDate || null, variety),
      entryId: entry.id,
    }
  })
)

const fertilizationCount = computed(() =>
  schedules.value.reduce((sum, schedule) => sum + schedule.fertilizationEvents.length, 0)
)

const currentTabLabel = computed(() =>
  tabs.find(tab => tab.id === activeTab.value)?.label ?? 'Planung'
)

async function submitLogin() {
  authError.value = ''
  try {
    await loginAccount(authEmail.value, authPassword.value)
    authPassword.value = ''
  } catch (error) {
    authError.value = error.message || 'Anmeldung fehlgeschlagen'
  }
}

async function submitRegister() {
  authError.value = ''
  try {
    await registerAccount(authEmail.value, authPassword.value)
    authPassword.value = ''
  } catch (error) {
    authError.value = error.message || 'Registrierung fehlgeschlagen'
  }
}

onMounted(() => {
  initializeSession()
})
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-topbar {
  background:
    linear-gradient(120deg, rgba(18, 67, 48, 0.92), rgba(39, 92, 62, 0.82)),
    url('https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1600&q=80');
  background-position: center;
  background-size: cover;
  color: white;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.brand-mark {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.28);
  font-size: 1.8rem;
  backdrop-filter: blur(12px);
}

.eyebrow {
  color: currentColor;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.72;
}

.brand-title {
  font-size: clamp(2rem, 4vw, 3.4rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
}

.brand-copy {
  max-width: 560px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.98rem;
}

.toolbar-panel {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(14px);
}

.topbar-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.75rem;
}

.toolbar-label {
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.year-input {
  width: 92px;
  text-align: center;
  font-weight: 800;
}

.account-panel {
  width: min(100%, 620px);
  padding: 0.65rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(14px);
}

.account-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
}

.account-actions,
.auth-form,
.conflict-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.auth-form .form-control {
  width: 150px;
}

.auth-error {
  width: 100%;
  color: #fee2e2;
  font-size: 0.78rem;
  font-weight: 700;
}

.sync-pill {
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: white;
  font-size: 0.74rem;
  font-weight: 800;
}

.sync-synced {
  background: rgba(22, 163, 74, 0.55);
}

.sync-pending,
.sync-syncing {
  background: rgba(234, 179, 8, 0.6);
}

.sync-error,
.sync-conflict {
  background: rgba(220, 38, 38, 0.55);
}

.app-main {
  padding-top: 1.25rem;
  padding-bottom: 2rem;
}

.dashboard-strip {
  margin-top: -2.2rem;
  margin-bottom: 1rem;
}

.conflict-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 8px;
}

.metric-tile {
  min-height: 92px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: var(--shadow);
}

.metric-label {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.metric-tile strong {
  color: var(--ink);
  font-size: 1.65rem;
  line-height: 1.1;
}

.app-tabs {
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 1px 8px rgba(23, 33, 25, 0.05);
}

.app-tabs .nav-link {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--muted);
  font-weight: 700;
  border-radius: 6px;
}

.app-tabs .nav-link.active {
  background: var(--green-700);
  color: white;
}

.tab-content {
  animation: fadeIn 0.16s ease;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.workspace-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: var(--shadow);
}

.section-heading {
  margin-bottom: 1rem;
}

.section-heading h2 {
  margin: 0;
  color: var(--ink);
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: 0;
}

.section-heading p:not(.eyebrow) {
  max-width: 720px;
  margin: 0.25rem 0 0;
  color: var(--muted);
  font-size: 0.92rem;
}

.empty-guidance {
  margin-top: 1rem;
  border-radius: 12px;
}

@media (max-width: 575px) {
  .brand-lockup {
    align-items: flex-start;
  }

  .brand-mark {
    width: 48px;
    height: 48px;
  }

  .toolbar-panel {
    width: 100%;
    justify-content: space-between;
  }

  .topbar-actions {
    width: 100%;
    align-items: stretch;
  }

  .auth-form .form-control {
    width: 100%;
  }

  .account-meta,
  .conflict-alert {
    align-items: flex-start;
    flex-direction: column;
  }

  .app-tabs {
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  .app-tabs .nav-link {
    white-space: nowrap;
  }
}
</style>
