<template>
  <div class="app">
    <!-- Header -->
    <header class="app-header">
      <div class="header-inner">
        <div class="brand">
          <span class="brand-icon">🌱</span>
          <div>
            <h1>Garten Saison Planer</h1>
            <p>Planung, Anzucht und Düngung für ein ganzes Gartenjahr</p>
          </div>
        </div>
        <div class="year-picker">
          <label for="year-sel">Jahr</label>
          <div class="year-controls">
            <button @click="year--">‹</button>
            <input id="year-sel" type="number" v-model.number="year" min="2024" max="2040" />
            <button @click="year++">›</button>
          </div>
        </div>
      </div>
    </header>

    <!-- Tabs -->
    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.id === 'plan' && selectedEntries.length > 0" class="tab-badge">{{ selectedEntries.length }}</span>
      </button>
    </nav>

    <!-- Main content -->
    <main class="main-content">

      <!-- Tab: Planung -->
      <div v-show="activeTab === 'plan'" class="tab-content">
        <div class="two-col">
          <section class="panel panel-left">
            <h2 class="panel-title">🌿 Pflanzen auswählen</h2>
            <p class="panel-sub">Klicke auf eine Pflanze, um sie zum Saison-Plan hinzuzufügen.</p>
            <PlantSelector v-model="selectedEntries" />
          </section>

          <section class="panel panel-right">
            <h2 class="panel-title">📅 Termine festlegen</h2>
            <p class="panel-sub">Lasse die idealen Termine errechnen oder gib deinen eigenen Aussaattermin ein.</p>
            <DateInputPanel v-model="selectedEntries" :year="year" />
          </section>
        </div>
      </div>

      <!-- Tab: Zeitplan (Gantt) -->
      <div v-show="activeTab === 'timeline'" class="tab-content">
        <section class="panel panel-full">
          <h2 class="panel-title">📊 Visueller Jahresplan {{ year }}</h2>
          <p class="panel-sub">Hover über die blauen Rauten für Düngungsdetails. Die rote Linie zeigt heute.</p>
          <GardenTimeline :schedules="schedules" :year="year" />
        </section>
      </div>

      <!-- Tab: Düngeplan -->
      <div v-show="activeTab === 'fert'" class="tab-content">
        <section class="panel panel-full">
          <h2 class="panel-title">🌿 Düngekalender {{ year }}</h2>
          <p class="panel-sub">Alle Düngegaben chronologisch geordnet mit Menge und Beschreibung.</p>
          <FertilizationSchedule :schedules="schedules" :year="year" />
        </section>
      </div>

      <!-- Tab: Export -->
      <div v-show="activeTab === 'export'" class="tab-content">
        <section class="panel panel-full">
          <h2 class="panel-title">⬇ Export & Druck</h2>
          <p class="panel-sub">Exportiere deinen Gartenplan als Kalender-Datei (.ics) oder drucke ihn aus.</p>
          <ExportPanel :schedules="schedules" :year="year" />
        </section>
      </div>

    </main>

    <!-- Footer hint when no plants selected -->
    <div v-if="selectedEntries.length === 0" class="onboarding">
      <div class="onboarding-inner">
        <span class="onboarding-icon">👈</span>
        <p>Starte im Tab <strong>Planung</strong> und wähle Pflanzen aus, um deinen persönlichen Gartenplan zu erstellen.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PlantSelector from './components/PlantSelector.vue'
import DateInputPanel from './components/DateInputPanel.vue'
import GardenTimeline from './components/GardenTimeline.vue'
import FertilizationSchedule from './components/FertilizationSchedule.vue'
import ExportPanel from './components/ExportPanel.vue'
import { plants } from './data/plants.js'
import { calculateSchedule } from './utils/dates.js'

const year = ref(new Date().getFullYear())
const activeTab = ref('plan')
const selectedEntries = ref([])

const tabs = [
  { id: 'plan',     icon: '🌱', label: 'Planung'    },
  { id: 'timeline', icon: '📊', label: 'Zeitplan'   },
  { id: 'fert',     icon: '🌿', label: 'Düngeplan'  },
  { id: 'export',   icon: '⬇',  label: 'Export'     },
]

const schedules = computed(() =>
  selectedEntries.value.map(entry => {
    const plant = plants.find(p => p.id === entry.plantId)
    return calculateSchedule(plant, year.value, entry.actualSowingDate || null)
  })
)
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.app-header {
  background: linear-gradient(135deg, var(--green-900) 0%, var(--green-800) 100%);
  color: white;
  padding: 1rem 0;
  box-shadow: 0 2px 12px rgba(0,0,0,0.2);
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.brand { display: flex; align-items: center; gap: 0.8rem; }
.brand-icon { font-size: 2.5rem; }
.brand h1 { font-size: 1.4rem; font-weight: 800; margin-bottom: 0.1rem; }
.brand p  { font-size: 0.8rem; opacity: 0.75; }

.year-picker { display: flex; flex-direction: column; align-items: flex-end; gap: 0.2rem; }
.year-picker label { font-size: 0.72rem; opacity: 0.7; letter-spacing: 0.05em; text-transform: uppercase; }
.year-controls { display: flex; align-items: center; gap: 0.3rem; }

.year-controls button {
  background: rgba(255,255,255,0.15);
  border: none;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.15s;
}
.year-controls button:hover { background: rgba(255,255,255,0.25); }

.year-controls input {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  width: 68px;
  text-align: center;
  padding: 0.3rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 700;
}

/* Tabs */
.tabs {
  background: white;
  border-bottom: 2px solid var(--green-200);
  display: flex;
  padding: 0 1.5rem;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.8rem 1.2rem;
  border: none;
  background: none;
  color: var(--gray-600);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  transition: all 0.15s;
  white-space: nowrap;
  position: relative;
}

.tab-btn:hover { color: var(--green-700); }
.tab-btn.active { color: var(--green-700); border-bottom-color: var(--green-600); }

.tab-icon { font-size: 1rem; }
.tab-label { }

.tab-badge {
  background: var(--green-600);
  color: white;
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
  font-weight: 700;
}

/* Main */
.main-content {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem;
}

.tab-content { animation: fadeIn 0.15s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.two-col {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 900px) {
  .two-col { grid-template-columns: 1fr; }
}

.panel {
  background: white;
  border: 1px solid var(--green-200);
  border-radius: 12px;
  padding: 1.2rem 1.4rem;
}

.panel-full { }

.panel-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--green-900);
  margin-bottom: 0.3rem;
}

.panel-sub {
  font-size: 0.8rem;
  color: var(--gray-400);
  margin-bottom: 1rem;
}

/* Onboarding hint */
.onboarding {
  max-width: 1200px;
  margin: 0 auto 1.5rem;
  padding: 0 1.5rem;
}

.onboarding-inner {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 0.8rem 1.2rem;
  font-size: 0.85rem;
  color: #92400e;
}

.onboarding-icon { font-size: 1.5rem; }
</style>
