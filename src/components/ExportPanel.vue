<template>
  <div class="export-panel">
    <div class="export-card">
      <div class="export-icon">📅</div>
      <div class="export-body">
        <h3>Kalender-Export (.ics)</h3>
        <p>Exportiert alle Aussaat-, Pflanz-, Ernte- und Düngetermine als iCal-Datei. Kompatibel mit Google Calendar, Apple Kalender, Outlook und allen gängigen Kalender-Apps.</p>

        <div class="options">
          <label class="option">
            <input type="checkbox" v-model="includeOpts.sowing" />
            <span>🌱 Aussaat & Auspflanztermine</span>
          </label>
          <label class="option">
            <input type="checkbox" v-model="includeOpts.harvest" />
            <span>🌾 Erntefenster</span>
          </label>
          <label class="option">
            <input type="checkbox" v-model="includeOpts.fertilization" />
            <span>🌿 Düngetermine</span>
          </label>
        </div>

        <div class="export-actions">
          <button class="btn-export" :disabled="schedules.length === 0" @click="doExport">
            ⬇ Kalender-Datei herunterladen
          </button>
          <span v-if="schedules.length === 0" class="export-hint">Keine Pflanzen ausgewählt</span>
          <span v-else class="export-hint">{{ eventCount }} Termine für {{ schedules.length }} Pflanze{{ schedules.length !== 1 ? 'n' : '' }}</span>
        </div>
      </div>
    </div>

    <div class="export-card" style="margin-top:1rem">
      <div class="export-icon">🖨</div>
      <div class="export-body">
        <h3>Druckansicht</h3>
        <p>Öffnet eine druckoptimierte Ansicht des Gartenplans.</p>
        <button class="btn-secondary" @click="printPlan">Drucken / Als PDF speichern</button>
      </div>
    </div>

    <!-- Plan overview for print / review -->
    <div class="plan-overview" v-if="schedules.length > 0">
      <h3>Übersicht {{ year }}</h3>
      <table class="overview-table">
        <thead>
          <tr>
            <th>Pflanze</th>
            <th>Aussaat</th>
            <th>Auspflanzen</th>
            <th>Erste Ernte</th>
            <th>Letzte Ernte</th>
            <th>Düngegaben</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in schedules" :key="s.plant.id">
            <td>
              <span class="tbl-plant" :style="`color:${s.plant.color}`">
                {{ s.plant.icon }} {{ s.plant.name }}
              </span>
            </td>
            <td>{{ fmt(s.sowingDate) }}</td>
            <td>{{ s.transplantingDate ? fmt(s.transplantingDate) : '–' }}</td>
            <td>{{ fmt(s.firstHarvestDate) }}</td>
            <td>{{ fmt(s.lastHarvestDate) }}</td>
            <td class="fert-count">{{ s.fertilizationEvents.length }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { generateIcal, downloadIcal } from '../utils/ical.js'
import { formatDate } from '../utils/dates.js'

const props = defineProps({
  schedules: { type: Array, required: true },
  year: { type: Number, required: true },
})

const includeOpts = reactive({ sowing: true, harvest: true, fertilization: true })

const eventCount = computed(() => {
  let n = 0
  for (const s of props.schedules) {
    if (includeOpts.sowing) n += 1 + (s.transplantingDate ? 1 : 0)
    if (includeOpts.harvest) n += 1
    if (includeOpts.fertilization) n += s.fertilizationEvents.length
  }
  return n
})

function filterSchedules(schedules) {
  return schedules.map(s => ({
    ...s,
    fertilizationEvents: includeOpts.fertilization ? s.fertilizationEvents : [],
    _skipSowing: !includeOpts.sowing,
    _skipHarvest: !includeOpts.harvest,
  }))
}

function doExport() {
  const filtered = filterSchedules(props.schedules)
  const ical = generateIcal(filtered, props.year)
  downloadIcal(ical, `Gartenplan-${props.year}.ics`)
}

function printPlan() {
  window.print()
}

function fmt(date) {
  return formatDate(date)
}
</script>

<style scoped>
.export-panel { display: flex; flex-direction: column; gap: 1rem; }

.export-card {
  display: flex;
  gap: 1.2rem;
  background: white;
  border: 1px solid var(--green-200);
  border-radius: 12px;
  padding: 1.2rem 1.4rem;
}

.export-icon { font-size: 2.5rem; flex-shrink: 0; align-self: flex-start; }

.export-body { flex: 1; }

.export-body h3 { font-size: 1rem; font-weight: 700; color: var(--green-900); margin-bottom: 0.4rem; }
.export-body p { font-size: 0.85rem; color: var(--gray-600); margin-bottom: 0.8rem; line-height: 1.5; }

.options { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }

.option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--gray-700);
  cursor: pointer;
}

.option input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--green-600); }

.export-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }

.btn-export {
  padding: 0.6rem 1.4rem;
  background: var(--green-700);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-export:hover:not(:disabled) { background: var(--green-800); }
.btn-export:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-secondary {
  padding: 0.5rem 1.2rem;
  background: white;
  color: var(--green-700);
  border: 2px solid var(--green-300);
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-secondary:hover { background: var(--green-50); border-color: var(--green-600); }

.export-hint { font-size: 0.78rem; color: var(--gray-400); }

.plan-overview { background: white; border: 1px solid var(--green-200); border-radius: 12px; padding: 1.2rem; }
.plan-overview h3 { font-size: 0.95rem; font-weight: 700; color: var(--green-800); margin-bottom: 0.8rem; }

.overview-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.overview-table th {
  text-align: left;
  padding: 0.5rem 0.6rem;
  background: var(--green-50);
  color: var(--green-800);
  font-weight: 600;
  border-bottom: 2px solid var(--green-200);
}
.overview-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--green-100); }
.overview-table tr:last-child td { border-bottom: none; }

.tbl-plant { font-weight: 600; }
.fert-count {
  text-align: center;
  font-weight: 700;
  color: var(--blue);
}
</style>
