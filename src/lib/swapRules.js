const LEAVE_CODES = new Set(['AL', 'SL', 'EDT', 'STT'])

// Accepts "HH:MM-HH:MM" and "HHMM-HHMM" formats
function isShift(value) {
  if (!value || LEAVE_CODES.has(value)) return false
  return /^\d{2,4}[:]?\d{0,2}-/.test(String(value).trim())
}

function parseTimePart(part) {
  const p = part.trim()
  if (p.includes(':')) {
    const [h, m] = p.split(':').map(Number)
    return { hour: h, min: m || 0 }
  }
  const padded = p.padStart(4, '0')
  return { hour: Number(padded.slice(0, 2)), min: Number(padded.slice(2)) || 0 }
}

function shiftToMinutes(dateISO, shift) {
  const [year, month, day] = dateISO.split('-').map(Number)
  const baseMins = new Date(year, month - 1, day).getTime() / 60000
  const [startPart, endPart] = shift.split('-')
  const { hour: startHour, min: startMin } = parseTimePart(startPart)
  const { hour: endHour, min: endMin } = parseTimePart(endPart)
  const startMins = baseMins + startHour * 60 + startMin
  let endMins = baseMins + endHour * 60 + endMin
  if (endHour < startHour) endMins += 24 * 60
  return { startMins, endMins }
}

function isNightShift(shift) {
  return shift.startsWith('22:') || /^22\d/.test(shift)
}

// Full fatigue check against the entire schedule, with one swap applied.
// Uses precomputed arrays — no object creation or Date() calls in the hot path.
function validateFatigueWithSwap(baseShifts, baseEntries, removedDate, insertedDate, insertedShift, insertedTiming) {
  // Build the post-swap shifts array by scanning baseShifts once (O(n_shifts))
  const shifts = []
  const needsInsert = isShift(insertedShift)
  let inserted = false

  for (const s of baseShifts) {
    if (s.date === removedDate) continue
    if (s.date === insertedDate) continue  // replaced by the new entry
    if (needsInsert && !inserted && insertedTiming.startMins <= s.startMins) {
      shifts.push({ date: insertedDate, shift: insertedShift, ...insertedTiming })
      inserted = true
    }
    shifts.push(s)
  }
  if (needsInsert && !inserted) {
    shifts.push({ date: insertedDate, shift: insertedShift, ...insertedTiming })
  }

  // Rule 1: ≥11 hours between every consecutive pair of shifts
  for (let i = 0; i < shifts.length - 1; i++) {
    if (shifts[i + 1].startMins - shifts[i].endMins < 11 * 60) return false
  }

  // Rule 2: ≥48 hours after a run of night shifts
  let i = 0
  while (i < shifts.length) {
    if (isNightShift(shifts[i].shift)) {
      let j = i
      while (j + 1 < shifts.length && isNightShift(shifts[j + 1].shift)) j++
      if (j + 1 < shifts.length && shifts[j + 1].startMins - shifts[j].endMins < 48 * 60) return false
      i = j + 1
    } else {
      i++
    }
  }

  // Rule 3: ≤7 consecutive shifts — scan all entries (including days off) with swap applied inline
  let consecutive = 0
  for (const [date, e] of baseEntries) {
    const shift = date === removedDate ? '' : date === insertedDate ? insertedShift : e.shift
    if (isShift(shift)) {
      if (++consecutive > 7) return false
    } else {
      consecutive = 0
    }
  }

  return true
}

export function buildPrecomputed(schedule) {
  const precomputed = {}
  for (const [name, sched] of Object.entries(schedule)) {
    const shifts = Object.entries(sched)
      .filter(([, e]) => isShift(e.shift))
      .map(([date, e]) => ({ date, shift: e.shift, ...shiftToMinutes(date, e.shift) }))
      .sort((a, b) => a.startMins - b.startMins)
    const entries = Object.entries(sched).sort(([a], [b]) => a.localeCompare(b))
    precomputed[name] = { shifts, entries }
  }
  return precomputed
}

// Returns all of the doctor's actual shift dates and times, sorted by date.
export function getDoctorShifts(doctor, schedule) {
  const sched = schedule[doctor] || {}
  return Object.entries(sched)
    .filter(([, e]) => isShift(e.shift))
    .map(([date, e]) => ({ date, shift: e.shift }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Finds valid swap partners for ONE specific shift the doctor wants to give up.
// Fast (~1ms) — only processes that one date, not the entire schedule.
export function calculateValidSwapsForDate(doctor, schedule, targetDate, precomputed) {
  const mySchedule = schedule[doctor] || {}
  const myShiftValue = mySchedule[targetDate]?.shift
  if (!isShift(myShiftValue)) return []

  const pc = precomputed || buildPrecomputed(schedule)
  const { shifts: myShifts, entries: myEntries } = pc[doctor] || { shifts: [], entries: [] }
  const myShiftEntry = myShifts.find(s => s.date === targetDate)
  if (!myShiftEntry) return []

  const myShift = myShiftEntry.shift
  const myTiming = { startMins: myShiftEntry.startMins, endMins: myShiftEntry.endMins }

  // Always compute today fresh — never use a cached/stale value
  const _now = new Date()
  const todayISO = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`

  // Dates the doctor already occupies (excluding the shift they're giving up)
  const myOccupiedDates = new Set(myShifts.filter(s => s.date !== targetDate).map(s => s.date))

  const results = []

  for (const partnerName of Object.keys(schedule)) {
    if (partnerName === doctor) continue
    const { shifts: partnerShifts, entries: partnerEntries } = pc[partnerName] || { shifts: [], entries: [] }

    // Dates the partner already occupies (all of them — used for conflict check below)
    const partnerOccupiedDates = new Set(partnerShifts.map(s => s.date))

    for (const partnerShiftEntry of partnerShifts) {
      const partnerDate = partnerShiftEntry.date
      const partnerShift = partnerShiftEntry.shift
      const partnerTiming = { startMins: partnerShiftEntry.startMins, endMins: partnerShiftEntry.endMins }

      // Partner shift must be after the date being swapped — can't take an earlier shift in exchange
      if (partnerDate <= targetDate) continue

      // Doctor can't take a shift on a day they're already working
      if (myOccupiedDates.has(partnerDate)) continue

      // Partner can't take the doctor's shift on a day they're already working
      if (partnerOccupiedDates.has(targetDate)) continue

      if (
        validateFatigueWithSwap(myShifts, myEntries, targetDate, partnerDate, partnerShift, partnerTiming) &&
        validateFatigueWithSwap(partnerShifts, partnerEntries, partnerDate, targetDate, myShift, myTiming)
      ) {
        results.push({ myDate: targetDate, myShift, partnerName, partnerDate, partnerShift })
        break
      }
    }
  }

  return results
}
