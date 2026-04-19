<template>
  <div class="plant-selector">
    <div v-for="cat in CATEGORIES" :key="cat" class="category-section">
      <h3 class="category-title">{{ cat }}</h3>
      <div class="plant-grid">
        <button
          v-for="plant in plantsByCategory(cat)"
          :key="plant.id"
          class="plant-card"
          :class="{ selected: isSelected(plant.id) }"
          :style="isSelected(plant.id) ? `--card-color: ${plant.color}` : ''"
          @click="togglePlant(plant)"
        >
          <span class="plant-icon">{{ plant.icon }}</span>
          <span class="plant-name">{{ plant.name }}</span>
          <span class="plant-season">KW {{ plant.idealSowingWeeks[0] }}–{{ plant.idealSowingWeeks[1] }}</span>
          <span v-if="isSelected(plant.id)" class="check-mark">✓</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { plants, CATEGORIES } from '../data/plants.js'

const props = defineProps({
  modelValue: { type: Array, required: true },
})
const emit = defineEmits(['update:modelValue'])

function plantsByCategory(cat) {
  return plants.filter(p => p.category === cat)
}

function isSelected(id) {
  return props.modelValue.some(e => e.plantId === id)
}

function togglePlant(plant) {
  if (isSelected(plant.id)) {
    emit('update:modelValue', props.modelValue.filter(e => e.plantId !== plant.id))
  } else {
    emit('update:modelValue', [...props.modelValue, { plantId: plant.id, actualSowingDate: '' }])
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
  padding: 0.75rem 0.5rem;
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

.check-mark {
  position: absolute;
  top: 0.35rem;
  right: 0.45rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--card-color, var(--green-600));
}
</style>
