const LEAVE_CODES = new Set(['AL', 'SL', 'EDT', 'STT', 'SDT', 'LTFT'])
const OFF_CODES = new Set(['DO', 'BH', 'ZERO'])
const OFF_WORD = /\boff\b/i

function isWeekend(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay() // 0=Sun, 6=Sat
  return dow === 0 || dow === 6
}

function isNightShift(shiftTime) {
  const s = shiftTime.replace(/^\*/, '').trim()
  // Time-based (e.g. SMH format: "22:00-08:00")
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

      // Condition 3: at least 42 days from today
      if (dateMs < cutoffMs) {
        return { date, shiftTime, eligible: false, reason: 'This date is fewer than 6 weeks away.', isDayOff: false, isWithin6Weeks: true }
      }

      // Condition 4: fewer than 6 colleagues on leave on this date
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
