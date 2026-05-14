const LEAVE_CODES = new Set(['AL', 'SL', 'EDT', 'STT', 'SDT', 'LTFT'])
const OFF_CODES = new Set(['DO', 'BH', 'ZERO'])
const OFF_WORD = /\boff\b/i

// ED rota: minimum number of doctors that must remain on each shift pattern.
// Keyed by the 2-digit start hour of the shift (matches AE=0800, AF=1100, AG=1300, AH=2200).
const ED_SHIFT_MINIMUMS = { '08': 2, '11': 0, '13': 6, '22': 4 }

function getShiftStartHour(shift) {
  const s = String(shift).replace(/^\*/, '').trim()
  const match = s.match(/^(\d{2})[\d:]*\s*-/)
  return match ? match[1] : null
}

function countStaffOnShift(date, schedule, startHour) {
  let count = 0
  for (const days of Object.values(schedule)) {
    const entry = days[date]
    if (!entry) continue
    const shift = String(entry.shift || '').trim()
    if (!shift || LEAVE_CODES.has(shift.toUpperCase()) || OFF_CODES.has(shift.toUpperCase()) || OFF_WORD.test(shift)) continue
    if (getShiftStartHour(shift) === startHour) count++
  }
  return count
}

function isWeekend(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay() // 0=Sun, 6=Sat
  return dow === 0 || dow === 6
}

function isNightShift(shiftTime) {
  const s = shiftTime.replace(/^\*/, '').trim()
  // Time-based (e.g. ED format: "22:00-08:00")
  if (s.startsWith('22:') || /^22\d/.test(s)) return true
  // Code-based (e.g. Gen Med SHO format: "Night 1", "Night 2")
  return /^night\b/i.test(s)
}

function countColleaguesOnLeave(date, schedule, excludeDoctor) {
  return Object.values(
    Object.fromEntries(Object.entries(schedule).filter(([name]) => name !== excludeDoctor))
  ).filter(days => days[date] && LEAVE_CODES.has(String(days[date].shift).toUpperCase())).length
}

export function calculateLeaveEligibility(doctor, schedule, today) {
  const doctorSchedule = schedule[doctor] || {}
  const todayMs = new Date(today + 'T00:00:00').getTime()
  const cutoffMs = todayMs + 42 * 24 * 60 * 60 * 1000

  return Object.entries(doctorSchedule)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { shift }]) => {
      const shiftTime = shift || ''

      // Empty cell, leave/off code, or any cell containing the word "off" — treated as a day off
      if (shiftTime === '' || LEAVE_CODES.has(shiftTime.toUpperCase()) || OFF_CODES.has(shiftTime.toUpperCase()) || OFF_WORD.test(shiftTime)) {
        return { date, shiftTime, eligible: false, reason: null, isDayOff: true, isWithin6Weeks: false }
      }

      const dateMs = new Date(date + 'T00:00:00').getTime()

      // Past date
      if (dateMs < todayMs) {
        return { date, shiftTime, eligible: false, reason: 'This date has already passed. Therefore annual leave cannot be booked.', isDayOff: false, isWithin6Weeks: false }
      }

      // Condition 1: not a night shift (always ineligible, regardless of timing)
      if (isNightShift(shiftTime)) {
        return { date, shiftTime, eligible: false, reason: 'No leave can be requested on night shifts.', isDayOff: false, isWithin6Weeks: false }
      }

      // Condition 2: not a weekend (always ineligible, regardless of timing)
      if (isWeekend(date)) {
        return { date, shiftTime, eligible: false, reason: 'No leave can be requested on weekends.', isDayOff: false, isWithin6Weeks: false }
      }

      // Condition 3: ED minimum staffing — hard block regardless of notice period
      const startHour = getShiftStartHour(shiftTime)
      if (startHour !== null && startHour in ED_SHIFT_MINIMUMS) {
        const min = ED_SHIFT_MINIMUMS[startHour]
        const staffCount = countStaffOnShift(date, schedule, startHour)
        if (staffCount <= min) {
          return {
            date, shiftTime, eligible: false,
            reason: `This shift requires a minimum of ${min} doctor${min !== 1 ? 's' : ''} on the rota. There ${staffCount !== 1 ? 'are' : 'is'} currently only ${staffCount} scheduled — leave cannot be approved.`,
            isDayOff: false, isWithin6Weeks: false,
          }
        }
      }

      // Condition 4: at least 42 days from today
      if (dateMs < cutoffMs) {
        return { date, shiftTime, eligible: false, reason: 'This date is fewer than 6 weeks away.', isDayOff: false, isWithin6Weeks: true }
      }

      // Condition 5: fewer than 6 colleagues on leave on this date
      const colleaguesOnLeave = countColleaguesOnLeave(date, schedule, doctor)
      if (colleaguesOnLeave >= 6) {
        return {
          date, shiftTime, eligible: false,
          reason: `${colleaguesOnLeave} of your colleagues are already on leave on this date.`,
          isDayOff: false, isWithin6Weeks: false,
        }
      }

      return { date, shiftTime, eligible: true, reason: null, isDayOff: false, isWithin6Weeks: false }
    })
}
