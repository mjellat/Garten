<template>
  <div class="timeline-wrapper">
    <!-- Legend -->
    <div class="legend">
      <span v-for="l in legend" :key="l.label" class="legend-item">
        <span class="legend-swatch" :style="`background:${l.color}; opacity:${l.opacity ?? 1}`"></span>
        {{ l.label }}
      </span>
    </div>

    <div class="timeline-scroll table-responsive">
      <svg
        :viewBox="`0 0 ${W} ${svgHeight}`"
        :width="W"
        :height="svgHeight"
        class="timeline-svg"
      >
        <!-- Month header backgrounds -->
        <rect
          v-for="(m, i) in months"
          :key="`mbg-${i}`"
          :x="LEFT + m.xFrac * CHART_W"
          y="0"
          :width="m.widthFrac * CHART_W"
          :height="HEADER_H"
          :fill="i % 2 === 0 ? '#f0f5f0' : '#e8ede8'"
        />

        <!-- Month labels -->
        <text
          v-for="(m, i) in months"
          :key="`ml-${i}`"
          :x="LEFT + (m.xFrac + m.widthFrac / 2) * CHART_W"
          :y="HEADER_H / 2 + 5"
          text-anchor="middle"
          font-size="11"
          font-weight="600"
          fill="#5c7a5c"
        >{{ m.name }}</text>

        <!-- Month dividers -->
        <line
          v-for="(m, i) in months"
          :key="`md-${i}`"
          :x1="LEFT + m.xFrac * CHART_W"
          :x2="LEFT + m.xFrac * CHART_W"
          y1="0"
          :y2="svgHeight"
          stroke="#c4d5c4"
          stroke-width="0.5"
        />

        <!-- Header bottom line -->
        <line :x1="LEFT" :x2="W - 8" :y1="HEADER_H" :y2="HEADER_H" stroke="#c4d5c4" stroke-width="1" />

        <!-- Today line -->
        <line
          v-if="todayFrac >= 0 && todayFrac <= 1"
          :x1="LEFT + todayFrac * CHART_W"
          :x2="LEFT + todayFrac * CHART_W"
          :y1="HEADER_H"
          :y2="svgHeight"
          stroke="#a85048"
          stroke-width="1.5"
          stroke-dasharray="4 3"
        />
        <text
          v-if="todayFrac >= 0 && todayFrac <= 1"
          :x="LEFT + todayFrac * CHART_W + 3"
          :y="HEADER_H + 10"
          font-size="9"
          fill="#a85048"
        >Heute</text>

        <!-- Plant rows -->
        <g v-for="(s, ri) in schedules" :key="s.entryId">
          <!-- Row background -->
          <rect
            :x="0"
            :y="rowY(ri)"
            :width="W"
            :height="ROW_H"
            :fill="ri % 2 === 0 ? '#ffffff' : '#faf9f7'"
          />

          <!-- Plant label -->
          <text
            :x="LEFT - 8"
            :y="rowY(ri) + ROW_H / 2 + 4"
            text-anchor="end"
            font-size="12"
            font-weight="600"
            :fill="s.plant.color"
          >{{ s.displayName }}</text>

          <!-- Ideal sowing window (light background) -->
          <rect
            :x="LEFT + dateFrac(s.idealSowStart) * CHART_W"
            :y="rowY(ri) + BAR_MARGIN"
            :width="Math.max(2, (dateFrac(s.idealSowEnd) - dateFrac(s.idealSowStart)) * CHART_W)"
            :height="BAR_H"
            fill="#d4b896"
            rx="3"
            opacity="0.55"
          />

          <!-- Sowing bar -->
          <rect
            :x="LEFT + dateFrac(s.sowingDate) * CHART_W - 4"
            :y="rowY(ri) + BAR_MARGIN - 2"
            :width="8"
            :height="BAR_H + 4"
            fill="#c07030"
            rx="2"
          />

          <!-- Indoor growing / transplanting phase -->
          <rect
            v-if="s.transplantingDate"
            :x="LEFT + dateFrac(s.sowingDate) * CHART_W"
            :y="rowY(ri) + BAR_MARGIN"
            :width="Math.max(0, (dateFrac(s.transplantingDate) - dateFrac(s.sowingDate)) * CHART_W)"
            :height="BAR_H"
            fill="#c8a040"
            rx="3"
            opacity="0.8"
          />

          <!-- Growing phase (transplanting → first harvest) -->
          <rect
            :x="LEFT + dateFrac(s.transplantingDate ?? s.sowingDate) * CHART_W"
            :y="rowY(ri) + BAR_MARGIN"
            :width="Math.max(0, (dateFrac(s.firstHarvestDate) - dateFrac(s.transplantingDate ?? s.sowingDate)) * CHART_W)"
            :height="BAR_H"
            :fill="s.plant.color"
            rx="3"
            opacity="0.65"
          />

          <!-- Harvest bar -->
          <rect
            :x="LEFT + dateFrac(s.firstHarvestDate) * CHART_W"
            :y="rowY(ri) + BAR_MARGIN"
            :width="Math.max(0, (dateFrac(s.lastHarvestDate) - dateFrac(s.firstHarvestDate)) * CHART_W)"
            :height="BAR_H"
            fill="#a85048"
            rx="3"
            opacity="0.75"
          />

          <!-- Fertilization markers -->
          <g
            v-for="f in s.fertilizationEvents"
            :key="f.id"
            class="fert-marker"
            @mouseenter="showTooltip($event, f)"
            @mouseleave="hideTooltip"
          >
            <polygon
              :points="diamond(LEFT + dateFrac(f.date) * CHART_W, rowY(ri) + ROW_H / 2)"
              :fill="fertColor(f.type)"
              stroke="white"
              stroke-width="1"
            />
          </g>
        </g>

        <!-- Row separator lines -->
        <line
          v-for="(s, ri) in schedules"
          :key="`sep-${ri}`"
          :x1="0"
          :x2="W"
          :y1="rowY(ri + 1)"
          :y2="rowY(ri + 1)"
          stroke="#e5e0d8"
          stroke-width="1"
        />
      </svg>
    </div>

    <!-- Tooltip -->
    <div
      v-if="tooltip.visible"
      class="tooltip"
      :style="`left:${tooltip.x}px; top:${tooltip.y}px`"
    >
      <strong>{{ tooltip.plantName }}: {{ tooltip.name }}</strong><br/>
      <span>{{ tooltip.date }}</span><br/>
      <span>{{ tooltip.description }}</span><br/>
      <em>{{ tooltip.amount }}</em>
    </div>

    <div v-if="schedules.length === 0" class="empty-state">
      Wähle Pflanzen im Tab "Planung" aus.
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { dateFraction, daysInYear, MONTH_NAMES, formatDate } from '../utils/dates.js'
import { FERTILIZER_TYPES } from '../data/plants.js'

const props = defineProps({
  schedules: { type: Array, required: true },
  year: { type: Number, required: true },
})

const W = 1000
const LEFT = 150
const CHART_W = W - LEFT - 8
const HEADER_H = 32
const ROW_H = 46
const BAR_H = 22
const BAR_MARGIN = (ROW_H - BAR_H) / 2

const svgHeight = computed(() => HEADER_H + Math.max(props.schedules.length, 1) * ROW_H + 8)

function rowY(idx) { return HEADER_H + idx * ROW_H }

function dateFrac(date) {
  if (!date) return 0
  return dateFraction(date, props.year)
}

const months = computed(() => {
  const result = []
  const totalDays = daysInYear(props.year)
  for (let m = 0; m < 12; m++) {
    const start = new Date(props.year, m, 1)
    const end   = new Date(props.year, m + 1, 0)
    result.push({
      name: MONTH_NAMES[m],
      xFrac:     dateFraction(start, props.year),
      widthFrac: (end.getDate()) / totalDays,
    })
  }
  return result
})

const todayFrac = computed(() => {
  const today = new Date()
  if (today.getFullYear() !== props.year) return -1
  return dateFraction(today, props.year)
})

function diamond(cx, cy, r = 5) {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
}

function fertColor(type) {
  return FERTILIZER_TYPES[type]?.color ?? '#6b7280'
}

const tooltip = reactive({ visible: false, x: 0, y: 0, name: '', plantName: '', date: '', description: '', amount: '' })

function showTooltip(event, f) {
  const rect = event.target.closest('.timeline-wrapper').getBoundingClientRect()
  tooltip.visible = true
  tooltip.x = event.clientX - rect.left + 12
  tooltip.y = event.clientY - rect.top - 10
  tooltip.name = f.name
  tooltip.plantName = f.plantName
  tooltip.date = formatDate(f.date)
  tooltip.description = f.description
  tooltip.amount = f.amount
}

function hideTooltip() { tooltip.visible = false }

const legend = [
  { label: 'Ideales Aussaatfenster', color: '#d4b896', opacity: 0.9 },
  { label: 'Aussaatpunkt',           color: '#c07030' },
  { label: 'Anzucht / Jungpflanze',  color: '#c8a040' },
  { label: 'Wachstum',               color: '#5c7a5c', opacity: 0.7 },
  { label: 'Ernte',                  color: '#a85048', opacity: 0.8 },
  { label: 'Düngung (Marker)',        color: '#4a6fa5' },
  { label: 'Heute',                  color: '#a85048' },
]
</script>

<style scoped>
.timeline-wrapper { position: relative; }

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1.2rem;
  margin-bottom: 1rem;
  font-size: 0.78rem;
  color: var(--muted);
}

.legend-item { display: flex; align-items: center; gap: 0.35rem; }

.legend-swatch {
  width: 14px;
  height: 10px;
  border-radius: 4px;
  flex-shrink: 0;
}

.timeline-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: white;
  box-shadow: 0 12px 32px rgba(30, 56, 38, 0.08);
}

.timeline-svg { display: block; }

.fert-marker { cursor: pointer; }
.fert-marker polygon { transition: transform 0.1s; transform-origin: center; }
.fert-marker:hover polygon { transform: scale(1.4); }

.tooltip {
  position: absolute;
  background: rgba(20, 30, 20, 0.92);
  color: white;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  font-size: 0.78rem;
  line-height: 1.5;
  max-width: 260px;
  pointer-events: none;
  z-index: 100;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--gray-400);
  font-size: 0.9rem;
}
</style>
