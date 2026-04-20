<template>
  <div class="fert-schedule">
    <div v-if="allEvents.length === 0" class="empty-state alert alert-light">
      Keine Pflanzen ausgewählt. Gehe zu "Planung" um Pflanzen hinzuzufügen.
    </div>

    <template v-else>
      <div v-for="group in groupedEvents" :key="group.month" class="month-group">
        <h3 class="month-header">
          <span class="month-name">{{ group.monthName }}</span>
          <span class="event-count">{{ group.events.length }} Maßnahme{{ group.events.length !== 1 ? 'n' : '' }}</span>
        </h3>

        <div class="events-list">
          <div v-for="ev in group.events" :key="`${ev.plantId}-${ev.id}-${ev.date}`" class="event-card">
            <div class="event-date-col">
              <span class="event-day">{{ formatDay(ev.date) }}</span>
              <span class="event-month-short">{{ formatMonthShort(ev.date) }}</span>
            </div>

            <div class="event-body">
              <div class="event-top">
                <span class="plant-badge badge" :style="`--c: ${ev.plantColor}`">
                  {{ ev.plantName }}
                </span>
                <span class="fert-type-badge badge" :style="`color:${typeInfo(ev.type).color}; background:${typeInfo(ev.type).bg}`">
                  {{ typeInfo(ev.type).label }}
                </span>
              </div>
              <p class="event-name">{{ ev.name }}</p>
              <p class="event-desc">{{ ev.description }}</p>
              <p class="event-amount"><strong>Menge:</strong> {{ ev.amount }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="summary-box">
        <h4>Zusammenfassung {{ year }}</h4>
        <div class="summary-grid">
          <div v-for="(items, type) in byType" :key="type" class="summary-item">
            <span class="summary-swatch" :style="`background: ${typeInfo(type).color}`"></span>
            <span class="summary-label">{{ typeInfo(type).label }}</span>
            <span class="summary-count">{{ items.length }}×</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { FERTILIZER_TYPES as FT, plants } from '../data/plants.js'

const props = defineProps({
  schedules: { type: Array, required: true },
  year: { type: Number, required: true },
})

const MONTH_NAMES_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

const allEvents = computed(() => {
  return props.schedules
    .flatMap(s => s.fertilizationEvents)
    .sort((a, b) => a.date - b.date)
})

const groupedEvents = computed(() => {
  const groups = {}
  for (const ev of allEvents.value) {
    const m = ev.date.getMonth()
    if (!groups[m]) groups[m] = { month: m, monthName: MONTH_NAMES_DE[m], events: [] }
    groups[m].events.push(ev)
  }
  return Object.values(groups).sort((a, b) => a.month - b.month)
})

const byType = computed(() => {
  const acc = {}
  for (const ev of allEvents.value) {
    if (!acc[ev.type]) acc[ev.type] = []
    acc[ev.type].push(ev)
  }
  return acc
})

function getPlant(id) {
  return plants.find(p => p.id === id)
}

function typeInfo(type) {
  return FT[type] ?? { label: type, color: '#6b7280', bg: '#f3f4f6' }
}

function formatDay(date) {
  return String(date.getDate()).padStart(2, '0')
}

function formatMonthShort(date) {
  return ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][date.getMonth()]
}
</script>

<style scoped>
.fert-schedule { display: flex; flex-direction: column; gap: 1.5rem; }

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--gray-400);
  font-size: 0.9rem;
  border: 1px dashed var(--border);
  border-radius: 10px;
}

.month-group {}

.month-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.6rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--border);
}

.month-name {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--green-900);
}
.event-count { font-size: 0.75rem; color: var(--gray-400); font-weight: 400; }

.events-list { display: flex; flex-direction: column; gap: 0.5rem; }

.event-card {
  display: flex;
  gap: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.85rem 0.95rem;
  transition: box-shadow 0.15s;
  box-shadow: 0 8px 22px rgba(30, 56, 38, 0.05);
}

.event-card:hover { box-shadow: 0 12px 30px rgba(30, 56, 38, 0.09); }

.event-date-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  background: var(--green-50);
  border-radius: 8px;
  padding: 0.3rem;
}

.event-day { font-size: 1.1rem; font-weight: 700; color: var(--green-800); line-height: 1; }
.event-month-short { font-size: 0.65rem; color: var(--green-600); text-transform: uppercase; letter-spacing: 0.05em; }

.event-body { flex: 1; display: flex; flex-direction: column; gap: 0.2rem; }

.event-top { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }

.plant-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--c) 12%, white);
  color: color-mix(in srgb, var(--c) 80%, #000);
  border: 1px solid color-mix(in srgb, var(--c) 25%, transparent);
}

.fert-type-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 8px;
}

.event-name { font-weight: 600; font-size: 0.88rem; color: var(--gray-800); }
.event-desc { font-size: 0.8rem; color: var(--gray-600); }
.event-amount { font-size: 0.78rem; color: var(--green-700); }

.summary-box {
  background: var(--green-50);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem 1.2rem;
}

.summary-box h4 {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--green-900);
  margin-bottom: 0.6rem;
}

.summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
}

.summary-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; }

.summary-swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.summary-label { color: var(--gray-600); }
.summary-count { font-weight: 700; color: var(--gray-800); }
</style>
