const LEAVE_CODES = new Set(['AL', 'SL', 'EDT', 'STT', 'SDT', 'LTFT'])
const OFF_CODES = new Set(['do', 'bh', 'zero'])
const OFF_WORD = /\boff\b/i

// Gen Med SHO swap groups — shifts can only be swapped within the same group.
// null = not swappable at all (ward specialty).
const GEN_MED_SHO_SWAP_GROUPS = {
  'take':         'take',
  'pt':           'pt',
  'take late 1':  'take_late',
  'take late 2':  'take_late',
  'amu long 1':   'amu_long',
  'amu long 2':   'amu_long',
  'ward late':    null,
  'ward weekend': null,
  'sdec':         'sdec',
  'night 1':      'night',
  'night 2':      'night',
  'ward':         null,
}

// Returns the swap group for a named Gen Med SHO shift, null if unswappable, undefined if not a named shift.
function getSwapGroup(shift) {
  const lower = String(shift).trim().toLowerCase()
  if (Object.prototype.hasOwnProperty.call(GEN_MED_SHO_SWAP_GROUPS, lower)) {
    return GEN_MED_SHO_SWAP_GROUPS[lower]
  }
  return undefined
}

// Gen Med SHO named shift codes → start/end times
const NAMED_SHIFT_TIMES = {
  'take':         { startH: 8,  startM: 30, endH: 21, endM: 0,  nextDay: false },
  'pt':           { startH: 8,  startM: 0,  endH: 17, endM: 0,  nextDay: false },
  'take late 1':  { startH: 8,  startM: 30, endH: 21, endM: 0,  nextDay: false },
  'take late 2':  { startH: 8,  startM: 30, endH: 21, endM: 0,  nextDay: false },
  'amu long 1':   { startH: 8,  startM: 30, endH: 21, endM: 0,  nextDay: false },
  'amu long 2':   { startH: 8,  startM: 30, endH: 21, endM: 0,  nextDay: false },
  'ward late':    { startH: 9,  startM: 0,  endH: 21, endM: 0,  nextDay: false },
  'ward weekend': { startH: 8,  startM: 30, endH: 21, endM: 0,  nextDay: false },
  'sdec':         { startH: 9,  startM: 0,  endH: 17, endM: 0,  nextDay: false },
  'night 1':      { startH: 20, startM: 30, endH: 9,  endM: 30, nextDay: true  },
  'night 2':      { startH: 20, startM: 30, endH: 9,  endM: 30, nextDay: true  },
  'ward':         { startH: 9,  startM: 0,  endH: 17, endM: 0,  nextDay: false },
}

// Accepts "HH:MM-HH:MM", "HHMM-HHMM", "HH:MM - HH:MM", or a named shift code
function isShift(value) {
  if (!value || LEAVE_CODES.has(String(value).toUpperCase())) return false
  if (OFF_WORD.test(String(value))) return false
  const lower = String(value).trim().toLowerCase()
  if (OFF_CODES.has(lower)) return false
  if (NAMED_SHIFT_TIMES[lower]) return true
  return /^\*?\d{2,4}[:]?\d{0,2}\s*-/.test(String(value).trim())
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

function shiftToMinutes(dateISO, shiftRaw) {
  const [year, month, day] = dateISO.split('-').map(Number)
  const baseMins = new Date(year, month - 1, day).getTime() / 60000

  const named = NAMED_SHIFT_TIMES[String(shiftRaw).trim().toLowerCase()]
  if (named) {
    const startMins = baseMins + named.startH * 60 + named.startM
    const endMins = baseMins + named.endH * 60 + named.endM + (named.nextDay ? 24 * 60 : 0)
    return { startMins, endMins }
  }

  const shift = shiftRaw.replace(/^\*/, '').trim()
  const match = shift.match(/^(\d{2,4}:?\d{0,2})\s*-\s*(\d{2,4}:?\d{0,2})/)
  if (!match) return { startMins: 0, endMins: 0 }
  const { hour: startHour, min: startMin } = parseTimePart(match[1])
  const { hour: endHour, min: endMin } = parseTimePart(match[2])
  const startMins = baseMins + startHour * 60 + startMin
  let endMins = baseMins + endHour * 60 + endMin
  if (endHour < startHour) endMins += 24 * 60
  return { startMins, endMins }
}

function isNightShift(shift) {
  const s = shift.replace(/^\*/, '').trim()
  if (s.startsWith('22:') || /^22\d/.test(s)) return true
  return /^night\b/i.test(s)
}

/**
 * Checks whether a single swap is fatigue-safe for one doctor.
 *
 * SCOPING INTENT — only the neighbourhood of the swap is evaluated:
 *   • Rule 1 (≥11 h gap):   pairs where one shift is insertedDate, OR the pair that
 *                            becomes newly adjacent because removedDate disappears.
 *   • Rule 2 (≥48 h post-nights): night runs that include insertedDate or that are
 *                            newly adjacent across the removedDate gap.
 *   • Rule 3 (≤7 consecutive): the run of consecutive working days that contains
 *                            insertedDate or either neighbour of removedDate.
 *
 * Pre-existing violations elsewhere in the year are intentionally ignored — they
 * exist independently of the proposed swap and must not be attributed to it.
 *
 * @returns {boolean} true if the swap passes all three rules for this doctor.
 */
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

  const removedIdx = baseShifts.findIndex(s => s.date === removedDate)
  const beforeRemoved = removedIdx > 0 ? baseShifts[removedIdx - 1] : null
  const afterRemoved = removedIdx >= 0 && removedIdx < baseShifts.length - 1 ? baseShifts[removedIdx + 1] : null

  // Rule 1: ≥11 hours — check pairs adjacent to insertedDate AND the gap created by removedDate
  for (let i = 0; i < shifts.length - 1; i++) {
    const cur = shifts[i]
    const nxt = shifts[i + 1]
    const touchesInsert = cur.date === insertedDate || nxt.date === insertedDate
    const touchesRemovalGap = beforeRemoved && afterRemoved &&
      cur.date === beforeRemoved.date && nxt.date === afterRemoved.date
    if (touchesInsert || touchesRemovalGap) {
      if (nxt.startMins - cur.endMins < 11 * 60) return false
    }
  }

  // Rule 2: ≥48 hours after nights — check runs touching insertedDate AND the removal gap
  let i = 0
  while (i < shifts.length) {
    if (isNightShift(shifts[i].shift)) {
      let j = i
      while (j + 1 < shifts.length && isNightShift(shifts[j + 1].shift)) j++
      if (j + 1 < shifts.length) {
        const nextShift = shifts[j + 1]
        const nightRunDates = shifts.slice(i, j + 1).map(s => s.date)
        const touchesInsert = nightRunDates.includes(insertedDate) || nextShift.date === insertedDate
        const touchesRemovalGap = beforeRemoved && afterRemoved && (
          nightRunDates.includes(beforeRemoved.date) || nextShift.date === afterRemoved.date
        )
        if (touchesInsert || touchesRemovalGap) {
          if (nextShift.startMins - shifts[j].endMins < 48 * 60) return false
        }
      }
      i = j + 1
    } else {
      i++
    }
  }

  // Rule 3: ≤7 consecutive shifts — check the run containing insertedDate OR neighbours of removedDate
  const affectedDates = new Set([insertedDate, beforeRemoved && beforeRemoved.date, afterRemoved && afterRemoved.date].filter(Boolean))

  let consecutive = 0
  let inAffectedRun = false
  let maxInAffectedRun = 0

  for (const [date, e] of baseEntries) {
    const shift = date === removedDate ? '' : date === insertedDate ? insertedShift : e.shift
    if (isShift(shift)) {
      consecutive++
      if (affectedDates.has(date)) inAffectedRun = true
      if (inAffectedRun) maxInAffectedRun = consecutive
    } else {
      if (inAffectedRun && maxInAffectedRun > 7) return false
      consecutive = 0
      inAffectedRun = false
      maxInAffectedRun = 0
    }
  }
  if (inAffectedRun && maxInAffectedRun > 7) return false

  return true
}

// Returns a formatted time string for a shift — e.g. "Take late 2" → "0830–2100".
// For time-string shifts the value already contains the time, so returns null.
export function getShiftTime(shift) {
  const named = NAMED_SHIFT_TIMES[String(shift).trim().toLowerCase()]
  if (!named) return null
  const start = `${String(named.startH).padStart(2, '0')}${String(named.startM).padStart(2, '0')}`
  const end = `${String(named.endH).padStart(2, '0')}${String(named.endM).padStart(2, '0')}`
  return `${start}–${end}`
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

      // Can't swap for a shift that has already passed
      if (partnerDate <= todayISO) continue

      // Doctor can't take a shift on a day they're already working
      if (myOccupiedDates.has(partnerDate)) continue

      // Partner can't take the doctor's shift on a day they're already working
      if (partnerOccupiedDates.has(targetDate)) continue

      // Enforce shift-type compatibility
      const myGroup = getSwapGroup(myShift)
      const partnerGroup = getSwapGroup(partnerShift)
      if (myGroup === null) return []          // myShift is a ward/unswappable shift
      if (partnerGroup === null) continue      // partner's shift is unswappable
      if (myGroup !== undefined && partnerGroup !== undefined) {
        if (myGroup !== partnerGroup) continue // named shifts must be the same type
      } else {
        if (isNightShift(myShift) !== isNightShift(partnerShift)) continue
      }

      if (
        validateFatigueWithSwap(myShifts, myEntries, targetDate, partnerDate, partnerShift, partnerTiming) &&
        validateFatigueWithSwap(partnerShifts, partnerEntries, partnerDate, targetDate, myShift, myTiming)
      ) {
        results.push({ myDate: targetDate, myShift, partnerName, partnerDate, partnerShift })
      }
    }
  }

  return results
}

// Like validateFatigueWithSwap but returns a human-readable reason string instead of a boolean.
function explainFatigueFailure(baseShifts, baseEntries, removedDate, insertedDate, insertedShift, insertedTiming) {
  const shifts = []
  const needsInsert = isShift(insertedShift)
  let inserted = false

  for (const s of baseShifts) {
    if (s.date === removedDate) continue
    if (s.date === insertedDate) continue
    if (needsInsert && !inserted && insertedTiming.startMins <= s.startMins) {
      shifts.push({ date: insertedDate, shift: insertedShift, ...insertedTiming })
      inserted = true
    }
    shifts.push(s)
  }
  if (needsInsert && !inserted) {
    shifts.push({ date: insertedDate, shift: insertedShift, ...insertedTiming })
  }

  const removedIdx = baseShifts.findIndex(s => s.date === removedDate)
  const beforeRemoved = removedIdx > 0 ? baseShifts[removedIdx - 1] : null
  const afterRemoved = removedIdx >= 0 && removedIdx < baseShifts.length - 1 ? baseShifts[removedIdx + 1] : null

  for (let i = 0; i < shifts.length - 1; i++) {
    const cur = shifts[i]
    const nxt = shifts[i + 1]
    const touchesInsert = cur.date === insertedDate || nxt.date === insertedDate
    const touchesRemovalGap = beforeRemoved && afterRemoved &&
      cur.date === beforeRemoved.date && nxt.date === afterRemoved.date
    if (touchesInsert || touchesRemovalGap) {
      const gap = nxt.startMins - cur.endMins
      if (gap < 11 * 60) {
        return `only ${(gap / 60).toFixed(1)}h between shifts on ${cur.date} and ${nxt.date} (need ≥11h)`
      }
    }
  }

  let i = 0
  while (i < shifts.length) {
    if (isNightShift(shifts[i].shift)) {
      let j = i
      while (j + 1 < shifts.length && isNightShift(shifts[j + 1].shift)) j++
      if (j + 1 < shifts.length) {
        const nextShift = shifts[j + 1]
        const nightRunDates = shifts.slice(i, j + 1).map(s => s.date)
        const touchesInsert = nightRunDates.includes(insertedDate) || nextShift.date === insertedDate
        const touchesRemovalGap = beforeRemoved && afterRemoved && (
          nightRunDates.includes(beforeRemoved.date) || nextShift.date === afterRemoved.date
        )
        if (touchesInsert || touchesRemovalGap) {
          const gap = nextShift.startMins - shifts[j].endMins
          if (gap < 48 * 60) {
            return `only ${(gap / 60).toFixed(1)}h after night shifts ending ${shifts[j].date} (need ≥48h)`
          }
        }
      }
      i = j + 1
    } else {
      i++
    }
  }

  const affectedDates = new Set([insertedDate, beforeRemoved && beforeRemoved.date, afterRemoved && afterRemoved.date].filter(Boolean))

  let consecutive = 0
  let inAffectedRun = false
  let maxInAffectedRun = 0

  for (const [date, e] of baseEntries) {
    const shift = date === removedDate ? '' : date === insertedDate ? insertedShift : e.shift
    if (isShift(shift)) {
      consecutive++
      if (affectedDates.has(date)) inAffectedRun = true
      if (inAffectedRun) maxInAffectedRun = consecutive
    } else {
      if (inAffectedRun && maxInAffectedRun > 7) return `more than 7 consecutive shifts around ${insertedDate}`
      consecutive = 0
      inAffectedRun = false
      maxInAffectedRun = 0
    }
  }
  if (inAffectedRun && maxInAffectedRun > 7) return `more than 7 consecutive shifts around ${insertedDate}`

  return null
}

// Returns every potential swap (partner date > targetDate) that fails, with a reason for each side.
// Used to explain to the doctor why no swaps were found.
export function getDiagnostics(doctor, schedule, targetDate, precomputed) {
  const mySchedule = schedule[doctor] || {}
  const myShiftValue = mySchedule[targetDate]?.shift
  if (!isShift(myShiftValue)) return []

  const pc = precomputed || buildPrecomputed(schedule)
  const { shifts: myShifts, entries: myEntries } = pc[doctor] || { shifts: [], entries: [] }
  const myShiftEntry = myShifts.find(s => s.date === targetDate)
  if (!myShiftEntry) return []

  const myShift = myShiftEntry.shift
  const myTiming = { startMins: myShiftEntry.startMins, endMins: myShiftEntry.endMins }
  const myOccupiedDates = new Set(myShifts.filter(s => s.date !== targetDate).map(s => s.date))
  const _now = new Date()
  const todayISO = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`

  const diagnostics = []

  for (const partnerName of Object.keys(schedule)) {
    if (partnerName === doctor) continue
    const { shifts: partnerShifts, entries: partnerEntries } = pc[partnerName] || { shifts: [], entries: [] }
    const partnerOccupiedDates = new Set(partnerShifts.map(s => s.date))

    for (const partnerShiftEntry of partnerShifts) {
      const partnerDate = partnerShiftEntry.date
      const partnerShift = partnerShiftEntry.shift
      const partnerTiming = { startMins: partnerShiftEntry.startMins, endMins: partnerShiftEntry.endMins }

      if (partnerDate <= todayISO) continue

      if (myOccupiedDates.has(partnerDate)) {
        diagnostics.push({ partnerName, partnerDate, partnerShift, myReason: 'you are already working on this date', partnerReason: null })
        continue
      }
      if (partnerOccupiedDates.has(targetDate)) {
        diagnostics.push({ partnerName, partnerDate, partnerShift, myReason: null, partnerReason: 'they already have a shift on your date' })
        continue
      }

      const myGroup = getSwapGroup(myShift)
      const partnerGroup = getSwapGroup(partnerShift)
      if (myGroup === null) return []
      if (partnerGroup === null) {
        diagnostics.push({ partnerName, partnerDate, partnerShift, myReason: 'ward shifts cannot be swapped', partnerReason: null })
        continue
      }
      if (myGroup !== undefined && partnerGroup !== undefined) {
        if (myGroup !== partnerGroup) {
          diagnostics.push({ partnerName, partnerDate, partnerShift, myReason: 'shifts can only be swapped with the same shift type', partnerReason: null })
          continue
        }
      } else if (isNightShift(myShift) !== isNightShift(partnerShift)) {
        diagnostics.push({ partnerName, partnerDate, partnerShift, myReason: 'night shifts can only be swapped with other night shifts', partnerReason: null })
        continue
      }

      const myReason = explainFatigueFailure(myShifts, myEntries, targetDate, partnerDate, partnerShift, partnerTiming)
      const partnerReason = explainFatigueFailure(partnerShifts, partnerEntries, partnerDate, targetDate, myShift, myTiming)

      // Both null → swap is valid; pre-existing violations elsewhere are never surfaced here.
      if (myReason || partnerReason) {
        diagnostics.push({ partnerName, partnerDate, partnerShift, myReason, partnerReason })
      }
    }
  }

  return diagnostics.sort((a, b) => a.partnerDate.localeCompare(b.partnerDate))
}
