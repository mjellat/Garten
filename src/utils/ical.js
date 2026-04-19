function icalDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function icalDateEnd(date) {
  // iCal all-day end is exclusive (next day)
  const next = new Date(date.getTime() + 86400000)
  return icalDate(next)
}

function uid(prefix, index) {
  return `${prefix}-${index}-gartenplaner@local`
}

function foldLine(line) {
  // RFC 5545: fold lines longer than 75 chars
  const bytes = [...line]
  if (bytes.length <= 75) return line
  let result = ''
  let i = 0
  while (i < bytes.length) {
    const chunk = bytes.slice(i, i + (i === 0 ? 75 : 74)).join('')
    result += (i === 0 ? '' : '\r\n ') + chunk
    i += i === 0 ? 75 : 74
  }
  return result
}

function vevent({ uid, summary, dtstart, dtend, description, categories }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : null,
    categories ? `CATEGORIES:${categories}` : null,
    'END:VEVENT',
  ]
  return lines.filter(Boolean).map(foldLine).join('\r\n')
}

export function generateIcal(schedules, year) {
  const events = []
  let idx = 0

  for (const s of schedules) {
    const name = s.plant.name

    // Sowing event
    events.push(vevent({
      uid: uid(`sow-${s.plant.id}`, idx++),
      summary: `🌱 ${name}: Aussaat`,
      dtstart: icalDate(s.sowingDate),
      dtend: icalDateEnd(s.sowingDate),
      description: s.plant.sowingType === 'indoor'
        ? `Indoor-Anzucht beginnen. ${s.plant.notes || ''}`
        : `Direktsaat im Beet. ${s.plant.notes || ''}`,
      categories: 'GARTEN,AUSSAAT',
    }))

    // Transplanting event
    if (s.transplantingDate) {
      events.push(vevent({
        uid: uid(`plant-${s.plant.id}`, idx++),
        summary: `🪴 ${name}: Auspflanzen`,
        dtstart: icalDate(s.transplantingDate),
        dtend: icalDateEnd(s.transplantingDate),
        description: `Jungpflanzen ins Beet setzen. ${s.plant.notes || ''}`,
        categories: 'GARTEN,AUSPFLANZEN',
      }))
    }

    // Harvest window
    events.push(vevent({
      uid: uid(`harvest-${s.plant.id}`, idx++),
      summary: `🌾 ${name}: Ernte beginnt`,
      dtstart: icalDate(s.firstHarvestDate),
      dtend: icalDate(s.lastHarvestDate),
      description: `Erntefenster: ${s.firstHarvestDate.toLocaleDateString('de-DE')} – ${s.lastHarvestDate.toLocaleDateString('de-DE')}`,
      categories: 'GARTEN,ERNTE',
    }))

    // Fertilization events
    for (const f of s.fertilizationEvents) {
      events.push(vevent({
        uid: uid(`fert-${s.plant.id}-${f.id}`, idx++),
        summary: `🌿 ${name}: ${f.name}`,
        dtstart: icalDate(f.date),
        dtend: icalDateEnd(f.date),
        description: `${f.description}\nMenge: ${f.amount}`,
        categories: `GARTEN,DÜNGEN`,
      }))
    }
  }

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Garten Saison Planer//DE',
    `X-WR-CALNAME:Gartenplaner ${year}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  return calendar
}

export function downloadIcal(content, filename) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
