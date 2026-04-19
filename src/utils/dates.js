export function isoWeekToDate(year, week) {
  // Returns the Monday of the given ISO week
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000)
  return new Date(monday.getTime() + (week - 1) * 7 * 86400000)
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

export function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date - start) / 86400000)
}

export function formatDate(date) {
  if (!date) return '–'
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateShort(date) {
  if (!date) return '–'
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

export function formatDateForInput(date) {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateInput(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysInYear(year) {
  return new Date(year, 11, 31).getDate() === 31 ? 365 : 366
}

// Returns fraction 0–1 of where `date` falls in `year`
export function dateFraction(date, year) {
  const start = new Date(year, 0, 1)
  const total = daysInYear(year) * 86400000
  return Math.max(0, Math.min(1, (date - start) / total))
}

export function calculateSchedule(plant, year, actualSowingDateStr = null) {
  const idealSowStart = isoWeekToDate(year, plant.idealSowingWeeks[0])
  const idealSowEnd   = isoWeekToDate(year, plant.idealSowingWeeks[1])
  const idealSowMid   = new Date((idealSowStart.getTime() + idealSowEnd.getTime()) / 2)

  const sowingDate = actualSowingDateStr ? parseDateInput(actualSowingDateStr) : idealSowMid

  let transplantingDate = null
  let firstHarvestDate  = null

  if (plant.daysToTransplant > 0) {
    let tp = addDays(sowingDate, plant.daysToTransplant)
    // Respect last frost week
    if (plant.lastFrostWeek) {
      const frostDate = isoWeekToDate(year, plant.lastFrostWeek)
      if (tp < frostDate) tp = frostDate
    }
    transplantingDate = tp
    firstHarvestDate = addDays(transplantingDate, plant.daysToFirstHarvest)
  } else {
    firstHarvestDate = addDays(sowingDate, plant.daysToFirstHarvest)
  }

  const lastHarvestDate = addDays(firstHarvestDate, plant.harvestDurationDays)

  const fertilizationEvents = plant.fertilization.map(f => {
    const base = f.event === 'sowing'        ? sowingDate
               : f.event === 'transplanting' ? (transplantingDate ?? sowingDate)
               : firstHarvestDate
    return {
      ...f,
      date:      addDays(base, f.daysOffset),
      plantId:   plant.id,
      plantName: plant.name,
      plantColor:plant.color,
    }
  }).filter(f => {
    const y = f.date.getFullYear()
    return y === year
  })

  return {
    plant,
    sowingDate,
    transplantingDate,
    firstHarvestDate,
    lastHarvestDate,
    idealSowStart,
    idealSowEnd,
    isActual: !!actualSowingDateStr,
    fertilizationEvents,
  }
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
