const LEAVE_CODES = new Set(['AL', 'SL', 'EDT', 'STT'])

function isShift(value) {
  return Boolean(value && value.includes(':') && !LEAVE_CODES.has(value))
}

function shiftToMinutes(dateISO, shift) {
  const [year, month, day] = dateISO.split('-').map(Number)
  const baseMins = new Date(year, month - 1, day).getTime() / 60000
  const [startPart, endPart] = shift.split('-')
  const [startHour, startMin] = startPart.split(':').map(Number)
  const [endHour, endMin] = endPart.split(':').map(Number)
  const startMins = baseMins + startHour * 60 + startMin
  let endMins = baseMins + endHour * 60 + endMin
  if (endHour < startHour) endMins += 24 * 60
  return { startMins, endMins }
}

function validateFatigue(doctorSchedule) {
  const entries = Object.entries(doctorSchedule).sort(([a], [b]) => a.localeCompare(b))

  const shifts = entries
    .filter(([, e]) => isShift(e.shift))
    .map(([date, e]) => ({ date, shift: e.shift, ...shiftToMinutes(date, e.shift) }))
    .sort((a, b) => a.startMins - b.startMins)

  // Rule 1: at least 11 hours between consecutive shifts
  for (let i = 0; i < shifts.length - 1; i++) {
    if (shifts[i + 1].startMins - shifts[i].endMins < 11 * 60) return { valid: false }
  }

  // Rule 2: at least 48 hours after a run of night shifts
  let i = 0
  while (i < shifts.length) {
    if (shifts[i].shift.startsWith('22:')) {
      let j = i
      while (j + 1 < shifts.length && shifts[j + 1].shift.startsWith('22:')) j++
      if (j + 1 < shifts.length && shifts[j + 1].startMins - shifts[j].endMins < 48 * 60) {
        return { valid: false }
      }
      i = j + 1
    } else {
      i++
    }
  }

  // Rule 3: no more than 7 consecutive shifts
  let consecutive = 0
  for (const [, e] of entries) {
    if (isShift(e.shift)) {
      if (++consecutive > 7) return { valid: false }
    } else {
      consecutive = 0
    }
  }

  return { valid: true }
}

export function calculateValidSwaps(doctor, schedule) {
  const mySchedule = schedule[doctor] || {}
  const myShiftDates = Object.entries(mySchedule)
    .filter(([, e]) => isShift(e.shift))
    .map(([date]) => date)
    .sort()

  const seen = new Set()
  const results = []

  for (const myDate of myShiftDates) {
    const myShift = mySchedule[myDate].shift

    for (const partnerName of Object.keys(schedule)) {
      if (partnerName === doctor) continue
      const key = `${myDate}|${partnerName}`
      if (seen.has(key)) continue

      const partnerSchedule = schedule[partnerName] || {}
      const partnerShiftDates = Object.entries(partnerSchedule)
        .filter(([, e]) => isShift(e.shift))
        .map(([date]) => date)

      for (const partnerDate of partnerShiftDates) {
        const partnerShift = partnerSchedule[partnerDate].shift

        const newDoctorSchedule = {
          ...mySchedule,
          [myDate]: { ...mySchedule[myDate], shift: '' },
          [partnerDate]: { shift: partnerShift, day: partnerSchedule[partnerDate]?.day || '' },
        }
        const newPartnerSchedule = {
          ...partnerSchedule,
          [partnerDate]: { ...partnerSchedule[partnerDate], shift: '' },
          [myDate]: { shift: myShift, day: mySchedule[myDate]?.day || '' },
        }

        if (validateFatigue(newDoctorSchedule).valid && validateFatigue(newPartnerSchedule).valid) {
          results.push({ myDate, myShift, partnerName, partnerDate, partnerShift })
          seen.add(key)
          break
        }
      }
    }
  }

  return results.sort((a, b) => a.myDate.localeCompare(b.myDate))
}
