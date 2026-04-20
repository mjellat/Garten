<template>
  <div class="date-panel">
    <div v-for="entry in modelValue" :key="entry.id" class="plant-entry">
      <!-- Entry header -->
      <div class="plant-header" :style="`--c: ${getPlant(entry.plantId).color}`">
        <div class="plant-header-names">
          <span class="plant-name">{{ getPlant(entry.plantId).name }}</span>
          <span v-if="getVariety(entry)" class="variety-name-small">{{ getVariety(entry).name }}</span>
        </div>
        <button class="remove-btn btn btn-sm" type="button" @click="remove(entry.id)" title="Entfernen">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Variety picker (only for plants with varieties AND no variety selected yet) -->
      <div v-if="getPlant(entry.plantId).varieties && !entry.varietyId" class="variety-picker">
        <p class="variety-picker-hint">Wähle eine Sorte:</p>
        <div class="variety-grid">
          <button
            v-for="v in getPlant(entry.plantId).varieties"
            :key="v.id"
            class="variety-card btn"
            type="button"
            @click="setVariety(entry.id, v.id)"
          >
            <div class="vc-top">
              <span class="vc-name">{{ v.name }}</span>
              <div class="vc-badges">
                <span class="badge badge-type">{{ v.type }}</span>
                <span v-if="v.isF1" class="badge badge-f1">F1</span>
                <span v-if="v.isParthenocarpic" class="badge badge-partheno">Parthenokarp</span>
                <span v-if="v.isSeedFast" class="badge badge-seed">Samenfest</span>
              </div>
            </div>
            <div class="vc-facts">
              <span class="vc-fact"><i class="bi bi-house" aria-hidden="true"></i> {{ v.cultivation }}</span>
              <span class="vc-fact"><i class="bi bi-rulers" aria-hidden="true"></i> {{ v.fruit.length }}</span>
              <span class="vc-fact"><i class="bi bi-palette" aria-hidden="true"></i> {{ v.fruit.color }}</span>
              <span v-if="v.resistances.length" class="vc-fact"><i class="bi bi-shield-check" aria-hidden="true"></i> {{ v.resistances.join(', ') }}</span>
            </div>
            <div class="vc-chars">
              <span v-for="c in v.characteristics" :key="c" class="vc-char">{{ c }}</span>
            </div>
            <p class="vc-notes">{{ v.notes }}</p>
          </button>
        </div>
        <button class="btn-no-variety btn btn-sm" type="button" @click="setVariety(entry.id, '__none__')">
          Ohne Sortenangabe fortfahren
        </button>
      </div>

      <!-- Variety info strip (when variety is selected) -->
      <div
        v-if="getPlant(entry.plantId).varieties && entry.varietyId && entry.varietyId !== '__none__'"
        class="variety-info-strip"
        :style="`--c: ${getPlant(entry.plantId).color}`"
      >
        <div class="vis-left">
          <div class="vis-badges">
            <span class="badge badge-type">{{ getVariety(entry).type }}</span>
            <span v-if="getVariety(entry).isF1" class="badge badge-f1">F1</span>
            <span v-if="getVariety(entry).isParthenocarpic" class="badge badge-partheno">Parthenokarp</span>
            <span v-if="getVariety(entry).isSeedFast" class="badge badge-seed">Samenfest</span>
          </div>
          <div class="vis-facts">
            <span><i class="bi bi-house" aria-hidden="true"></i> {{ getVariety(entry).cultivation }}</span>
            <span><i class="bi bi-rulers" aria-hidden="true"></i> {{ getVariety(entry).fruit.length }}</span>
            <span v-if="getVariety(entry).resistances.length"><i class="bi bi-shield-check" aria-hidden="true"></i> {{ getVariety(entry).resistances.join(', ') }}</span>
          </div>
          <p v-if="getVariety(entry).tip" class="vis-tip"><i class="bi bi-lightbulb" aria-hidden="true"></i> {{ getVariety(entry).tip }}</p>
        </div>
        <button class="btn-change-variety btn btn-sm" type="button" @click="clearVariety(entry.id)">Sorte ändern</button>
      </div>

      <!-- Date inputs and schedule preview (shown once variety is chosen OR no varieties) -->
      <div
        v-if="!getPlant(entry.plantId).varieties || entry.varietyId"
        class="dates-row"
      >
        <div class="date-field">
          <label>
            Ideales Aussaatfenster
            <span class="ideal-range">{{ idealRange(entry) }}</span>
          </label>
        </div>

        <div class="date-field">
          <label :for="`sow-${entry.id}`">Tatsächlicher Aussaattermin</label>
          <div class="input-row">
            <input
              type="date"
              class="form-control"
              :id="`sow-${entry.id}`"
              :value="entry.actualSowingDate"
              :min="`${year}-01-01`"
              :max="`${year}-12-31`"
              @change="updateDate(entry.id, $event.target.value)"
            />
            <button
              v-if="entry.actualSowingDate"
              class="clear-btn btn btn-sm"
              type="button"
              @click="updateDate(entry.id, '')"
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

    <!-- Add another variety button (shown when last entry is a variety-plant) -->
    <div v-if="canAddMore" class="add-more-row">
      <button class="btn-add-more btn btn-sm" type="button" @click="addAnother">
        <i class="bi bi-plus-lg" aria-hidden="true"></i> Weitere {{ lastVarietyPlant.name }}-Sorte hinzufügen
      </button>
    </div>

    <div v-if="modelValue.length === 0" class="empty-hint">
      Wähle links Pflanzen aus, um sie zum Plan hinzuzufügen.
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { plants } from '../data/plants.js'
import { calculateSchedule, formatDate, isoWeekToDate } from '../utils/dates.js'

const props = defineProps({
  modelValue: { type: Array, required: true },
  year: { type: Number, required: true },
})
const emit = defineEmits(['update:modelValue'])

function getPlant(plantId) {
  return plants.find(p => p.id === plantId)
}

function getVariety(entry) {
  if (!entry.varietyId || entry.varietyId === '__none__') return null
  return getPlant(entry.plantId).varieties?.find(v => v.id === entry.varietyId) ?? null
}

function idealRange(entry) {
  const plant   = getPlant(entry.plantId)
  const variety = getVariety(entry)
  const weeks   = variety?.idealSowingWeeks ?? plant.idealSowingWeeks
  const start   = isoWeekToDate(props.year, weeks[0])
  const end     = isoWeekToDate(props.year, weeks[1])
  return `${formatDate(start)} – ${formatDate(end)} (KW ${weeks[0]}–${weeks[1]})`
}

function getScheduleItems(entry) {
  const plant   = getPlant(entry.plantId)
  const variety = getVariety(entry)
  const s = calculateSchedule(plant, props.year, entry.actualSowingDate || null, variety)
  const items = [{ label: 'Aussaat', date: formatDate(s.sowingDate), color: '#f97316' }]
  if (s.transplantingDate) {
    items.push({ label: 'Auspflanzen', date: formatDate(s.transplantingDate), color: '#16a34a' })
  }
  items.push(
    { label: 'Erste Ernte', date: formatDate(s.firstHarvestDate), color: '#dc2626' },
    { label: 'Letzte Ernte',date: formatDate(s.lastHarvestDate),  color: '#991b1b' },
  )
  return items
}

// Show "add another variety" button if the last entry belongs to a variety-plant
const lastVarietyPlant = computed(() => {
  if (props.modelValue.length === 0) return null
  const last = props.modelValue[props.modelValue.length - 1]
  const plant = getPlant(last.plantId)
  return plant.varieties ? plant : null
})

const canAddMore = computed(() => !!lastVarietyPlant.value)

function addAnother() {
  const plant = lastVarietyPlant.value
  emit('update:modelValue', [
    ...props.modelValue,
    { id: `${plant.id}-${crypto.randomUUID()}`, plantId: plant.id, varietyId: null, actualSowingDate: '' },
  ])
}

function setVariety(entryId, varietyId) {
  emit('update:modelValue', props.modelValue.map(e =>
    e.id === entryId ? { ...e, varietyId } : e
  ))
}

function clearVariety(entryId) {
  emit('update:modelValue', props.modelValue.map(e =>
    e.id === entryId ? { ...e, varietyId: null } : e
  ))
}

function updateDate(entryId, val) {
  emit('update:modelValue', props.modelValue.map(e =>
    e.id === entryId ? { ...e, actualSowingDate: val } : e
  ))
}

function remove(entryId) {
  emit('update:modelValue', props.modelValue.filter(e => e.id !== entryId))
}
</script>

<style scoped>
.date-panel { display: flex; flex-direction: column; gap: 1rem; }

.plant-entry {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface);
  box-shadow: 0 10px 26px rgba(30, 56, 38, 0.06);
}

/* Header */
.plant-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--c) 10%, white);
  border-bottom: 1px solid color-mix(in srgb, var(--c) 18%, transparent);
}
.plant-header-names { flex: 1; display: flex; flex-direction: column; gap: 0.05rem; }
.plant-name { font-weight: 700; font-size: 0.95rem; color: var(--gray-800); }
.variety-name-small { font-size: 0.78rem; color: color-mix(in srgb, var(--c) 70%, #000); font-weight: 600; }

.remove-btn {
  background: white; border: 1px solid color-mix(in srgb, var(--c) 18%, transparent); color: var(--gray-400);
  font-size: 0.9rem; padding: 0.2rem 0.45rem; border-radius: 6px; cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.remove-btn:hover { color: var(--red); background: #fee2e2; }

/* Variety picker */
.variety-picker { padding: 1rem; background: linear-gradient(180deg, var(--green-50), white); }
.variety-picker-hint { font-size: 0.78rem; font-weight: 600; color: var(--green-700); margin-bottom: 0.7rem; }

.variety-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}

.variety-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.8rem 0.9rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.variety-card:hover {
  border-color: var(--green-400);
  box-shadow: 0 3px 12px rgba(42,37,32,0.08);
  transform: translateY(-1px);
}

.vc-top { display: flex; flex-direction: column; gap: 0.3rem; }
.vc-name { font-weight: 700; font-size: 0.9rem; color: var(--gray-800); }
.vc-badges { display: flex; flex-wrap: wrap; gap: 0.3rem; }

.badge {
  font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.45rem;
  border-radius: 6px; letter-spacing: 0.02em;
}
.badge-type     { background: #e0f2fe; color: #0369a1; }
.badge-f1       { background: #fef9c3; color: #a16207; }
.badge-partheno { background: #f3e8ff; color: #7e22ce; }
.badge-seed     { background: #dcfce7; color: #15803d; }

.vc-facts {
  display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem;
  font-size: 0.72rem; color: var(--gray-600);
}
.vc-chars { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.vc-char {
  font-size: 0.65rem; background: var(--green-100); color: var(--green-800);
  padding: 0.1rem 0.4rem; border-radius: 4px;
}
.vc-notes {
  font-size: 0.72rem; color: var(--gray-500); line-height: 1.4;
  margin-top: 0.1rem;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}

.btn-no-variety {
  font-size: 0.78rem; color: var(--gray-500); background: white;
  border: 1px dashed var(--gray-400); border-radius: 8px;
  padding: 0.35rem 0.8rem; cursor: pointer;
}
.btn-no-variety:hover { color: var(--gray-700); border-color: var(--gray-600); }

/* Variety info strip */
.variety-info-strip {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 1rem;
  background: color-mix(in srgb, var(--c) 6%, white);
  border-bottom: 1px solid color-mix(in srgb, var(--c) 15%, transparent);
}
.vis-left { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; }
.vis-badges { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.vis-facts { display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; font-size: 0.75rem; color: var(--gray-600); }
.vis-tip { font-size: 0.73rem; color: var(--green-700); font-style: italic; }

.btn-change-variety {
  flex-shrink: 0; font-size: 0.72rem; padding: 0.3rem 0.7rem;
  border: 1px solid var(--green-300); border-radius: 8px;
  background: white; color: var(--green-700); cursor: pointer;
}
.btn-change-variety:hover { background: var(--green-50); }

/* Date fields */
.dates-row {
  padding: 0.8rem 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1.5rem;
}
.date-field { display: flex; flex-direction: column; gap: 0.35rem; }
.date-field label {
  font-size: 0.78rem; font-weight: 600; color: var(--gray-600);
  display: flex; flex-direction: column; gap: 0.2rem;
}
.ideal-range { font-weight: 400; color: var(--green-700); font-size: 0.8rem; }

.input-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
input[type="date"] {
  padding: 0.4rem 0.6rem; border: 1px solid var(--border);
  border-radius: 8px; font-size: 0.85rem; color: var(--gray-800);
  outline: none; transition: border-color 0.15s; background: var(--surface);
  max-width: 190px;
}
input[type="date"]:focus { border-color: var(--green-400); }

.clear-btn {
  font-size: 0.72rem; padding: 0.3rem 0.6rem;
  border: 1px solid var(--green-300); border-radius: 8px;
  background: var(--green-50); color: var(--green-800); cursor: pointer;
}
.clear-btn:hover { background: var(--green-100); }

.schedule-preview {
  grid-column: 1 / -1;
  display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem;
  padding-top: 0.25rem;
  border-top: 1px dashed var(--border);
}
.sched-item { display: flex; align-items: center; gap: 0.4rem; }
.sched-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.sched-label { font-size: 0.75rem; color: var(--gray-600); }
.sched-date  { font-size: 0.8rem; font-weight: 600; color: var(--gray-800); }

/* Add more button */
.add-more-row { display: flex; justify-content: flex-start; }
.btn-add-more {
  font-size: 0.82rem; font-weight: 500; padding: 0.5rem 1rem;
  border: 1px dashed var(--green-200); border-radius: 8px;
  background: var(--green-50); color: var(--green-700);
  cursor: pointer; transition: all 0.15s;
}
.btn-add-more:hover { background: var(--green-100); border-color: var(--green-400); }

/* Empty state */
.empty-hint {
  padding: 2rem; text-align: center; color: var(--gray-400);
  font-size: 0.88rem; border: 1px dashed var(--border); border-radius: 10px;
}

@media (max-width: 640px) {
  .dates-row { grid-template-columns: 1fr; }
  input[type="date"] { max-width: none; }
  .variety-info-strip { flex-direction: column; }
}
</style>
