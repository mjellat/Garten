<template>
  <div class="plant-selector">
    <div v-for="cat in CATEGORIES" :key="cat" class="category-section">
      <h3 class="category-title">{{ cat }}</h3>
      <div class="plant-grid">
        <button
          v-for="plant in plantsByCategory(cat)"
          :key="plant.id"
          class="plant-card"
          :class="{ selected: countFor(plant.id) > 0 }"
          :style="countFor(plant.id) > 0 ? `--card-color: ${plant.color}` : ''"
          :title="plant.varieties ? 'Mehrere Sorten wählbar' : plant.name"
          @click="handleClick(plant)"
        >
          <span class="plant-icon">{{ plant.icon }}</span>
          <span class="plant-name">{{ plant.name }}</span>
          <span class="plant-season">KW {{ plant.idealSowingWeeks[0] }}–{{ plant.idealSowingWeeks[1] }}</span>

          <!-- Variety indicator -->
          <span v-if="plant.varieties" class="variety-hint" :title="`${plant.varieties.length} Sorten verfügbar`">
            {{ plant.varieties.length }} Sorten
          </span>

          <!-- Count badge for variety-plants (shows how many added) -->
          <span v-if="plant.varieties && countFor(plant.id) > 0" class="count-badge">
            {{ countFor(plant.id) }}×
          </span>
          <!-- Checkmark for non-variety plants -->
          <span v-else-if="!plant.varieties && countFor(plant.id) > 0" class="check-mark">✓</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { plants, CATEGORIES } from '../data/plants.js'

const props = defineProps({
  modelValue: { type: Array, required: true },
})
const emit = defineEmits(['update:modelValue'])

function plantsByCategory(cat) {
  return plants.filter(p => p.category === cat)
}

function countFor(plantId) {
  return props.modelValue.filter(e => e.plantId === plantId).length
}

function newEntry(plantId) {
  return { id: `${plantId}-${Date.now()}`, plantId, varietyId: null, actualSowingDate: '' }
}

function handleClick(plant) {
  if (plant.varieties) {
    // Always add a new entry – multiple varieties allowed
    emit('update:modelValue', [...props.modelValue, newEntry(plant.id)])
  } else {
    // Toggle: add or remove the single entry
    if (countFor(plant.id) > 0) {
      emit('update:modelValue', props.modelValue.filter(e => e.plantId !== plant.id))
    } else {
      emit('update:modelValue', [...props.modelValue, newEntry(plant.id)])
    }
  }
}
</script>

<style scoped>
.plant-selector { display: flex; flex-direction: column; gap: 1.5rem; }

.category-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--green-700);
  margin-bottom: 0.6rem;
}

.plant-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.5rem;
}

.plant-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.75rem 0.5rem 0.55rem;
  border: 2px solid var(--green-200);
  border-radius: 10px;
  background: white;
  transition: all 0.15s ease;
  cursor: pointer;
  text-align: center;
}

.plant-card:hover {
  border-color: var(--green-400);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.plant-card.selected {
  border-color: var(--card-color, var(--green-600));
  background: color-mix(in srgb, var(--card-color, var(--green-600)) 10%, white);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--card-color, var(--green-600)) 30%, transparent);
}

.plant-icon { font-size: 1.75rem; line-height: 1; }
.plant-name { font-size: 0.82rem; font-weight: 600; color: var(--gray-800); }
.plant-season { font-size: 0.7rem; color: var(--gray-400); }

.variety-hint {
  font-size: 0.62rem;
  color: var(--green-700);
  background: var(--green-100);
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
  font-weight: 600;
  margin-top: 0.1rem;
}

.check-mark {
  position: absolute;
  top: 0.35rem;
  right: 0.45rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--card-color, var(--green-600));
}

.count-badge {
  position: absolute;
  top: 0.25rem;
  right: 0.3rem;
  background: var(--card-color, var(--green-600));
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.1rem 0.35rem;
  border-radius: 10px;
  line-height: 1.3;
}
</style>
