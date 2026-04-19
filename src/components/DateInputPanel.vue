<template>
  <div class="date-panel">
    <div v-for="entry in modelValue" :key="entry.plantId" class="plant-entry">
      <div class="plant-header" :style="`--c: ${getPlant(entry.plantId).color}`">
        <span class="plant-icon">{{ getPlant(entry.plantId).icon }}</span>
        <span class="plant-name">{{ getPlant(entry.plantId).name }}</span>
        <span class="sowing-type-badge">{{ sowingTypeLabel(entry.plantId) }}</span>
        <button class="remove-btn" @click="remove(entry.plantId)" title="Entfernen">✕</button>
      </div>

      <div class="dates-row">
        <div class="date-field">
          <label>
            Ideales Aussaatfenster
            <span class="ideal-range">{{ idealRange(entry.plantId) }}</span>
          </label>
        </div>

        <div class="date-field">
          <label for="sow-{{ entry.plantId }}">Tatsächlicher Aussaattermin</label>
          <div class="input-row">
            <input
              type="date"
              :id="`sow-${entry.plantId}`"
              :value="entry.actualSowingDate"
              :min="`${year}-01-01`"
              :max="`${year}-12-31`"
              @change="updateDate(entry.plantId, $event.target.value)"
            />
            <button
              v-if="entry.actualSowingDate"
              class="clear-btn"
              @click="updateDate(entry.plantId, '')"
              title="Auf Idealtermin zurücksetzen"
            >Ideal verwenden</button>
          </div>
        </div>

        <div class="schedule-preview">
          <div v-for="item in getScheduleItems(entry)" :key="item.label" class="sched-item">
            <span class="sched-dot" :style="`background: ${item.color}`"></span>
            <span class="sched-label">{{ item.label }}</span>
            <span class="sched-date">{{ item.date }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modelValue.length === 0" class="empty-hint">
      Wähle links Pflanzen aus, um sie zum Plan hinzuzufügen.
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { plants } from '../data/plants.js'
import { calculateSchedule, formatDate, formatDateForInput, isoWeekToDate } from '../utils/dates.js'

const props = defineProps({
  modelValue: { type: Array, required: true },
  year: { type: Number, required: true },
})
const emit = defineEmits(['update:modelValue'])

function getPlant(id) {
  return plants.find(p => p.id === id)
}

function sowingTypeLabel(id) {
  const types = { indoor: 'Anzucht indoor', outdoor: 'Direktsaat', both: 'Indoor/Outdoor' }
  return types[getPlant(id).sowingType] ?? ''
}

function idealRange(id) {
  const plant = getPlant(id)
  const start = isoWeekToDate(props.year, plant.idealSowingWeeks[0])
  const end   = isoWeekToDate(props.year, plant.idealSowingWeeks[1])
  return `${formatDate(start)} – ${formatDate(end)} (KW ${plant.idealSowingWeeks[0]}–${plant.idealSowingWeeks[1]})`
}

function getScheduleItems(entry) {
  const plant = getPlant(entry.plantId)
  const s = calculateSchedule(plant, props.year, entry.actualSowingDate)
  const items = [
    { label: 'Aussaat',      date: formatDate(s.sowingDate),        color: '#f97316' },
  ]
  if (s.transplantingDate) {
    items.push({ label: 'Auspflanzen', date: formatDate(s.transplantingDate), color: '#16a34a' })
  }
  items.push(
    { label: 'Erste Ernte', date: formatDate(s.firstHarvestDate),  color: '#dc2626' },
    { label: 'Letzte Ernte',date: formatDate(s.lastHarvestDate),   color: '#991b1b' },
  )
  return items
}

function updateDate(plantId, val) {
  emit('update:modelValue', props.modelValue.map(e =>
    e.plantId === plantId ? { ...e, actualSowingDate: val } : e
  ))
}

function remove(plantId) {
  emit('update:modelValue', props.modelValue.filter(e => e.plantId !== plantId))
}
</script>

<style scoped>
.date-panel { display: flex; flex-direction: column; gap: 1rem; }

.plant-entry {
  border: 1px solid var(--green-200);
  border-radius: 10px;
  overflow: hidden;
  background: white;
}

.plant-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1rem;
  background: color-mix(in srgb, var(--c) 12%, white);
  border-bottom: 1px solid color-mix(in srgb, var(--c) 20%, transparent);
}

.plant-icon { font-size: 1.3rem; }
.plant-name { font-weight: 700; font-size: 0.95rem; flex: 1; }

.sowing-type-badge {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: 20px;
  background: color-mix(in srgb, var(--c) 20%, white);
  color: color-mix(in srgb, var(--c) 80%, #000);
  font-weight: 600;
}

.remove-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--gray-400);
  font-size: 0.9rem;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.remove-btn:hover { color: var(--red); background: #fee2e2; }

.dates-row {
  padding: 0.8rem 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1.5rem;
}

.date-field { display: flex; flex-direction: column; gap: 0.35rem; }

.date-field label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--gray-600);
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.ideal-range {
  font-weight: 400;
  color: var(--green-700);
  font-size: 0.8rem;
}

.input-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

input[type="date"] {
  padding: 0.4rem 0.6rem;
  border: 1.5px solid var(--green-200);
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--gray-800);
  outline: none;
  transition: border-color 0.15s;
}
input[type="date"]:focus { border-color: var(--green-600); }

.clear-btn {
  font-size: 0.72rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--green-300);
  border-radius: 5px;
  background: var(--green-50);
  color: var(--green-800);
  cursor: pointer;
}
.clear-btn:hover { background: var(--green-100); }

.schedule-preview {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  padding-top: 0.25rem;
  border-top: 1px dashed var(--green-200);
}

.sched-item { display: flex; align-items: center; gap: 0.4rem; }

.sched-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sched-label { font-size: 0.75rem; color: var(--gray-600); }
.sched-date  { font-size: 0.8rem;  font-weight: 600; color: var(--gray-800); }

.empty-hint {
  padding: 2rem;
  text-align: center;
  color: var(--gray-400);
  font-size: 0.9rem;
  border: 2px dashed var(--green-200);
  border-radius: 10px;
}
</style>
