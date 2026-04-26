const LEAVE_CODES = new Set(['AL', 'SL', 'EDT', 'STT'])

function isWeekend(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay() // 0=Sun, 6=Sat
  return dow === 0 || dow === 6
}

function isNightShift(shiftTime) {
  // Handles "22:00-08:30", "22:00 - 08:30", etc.
  return shiftTime.startsWith('22:') || shiftTime.startsWith('22 ')
}

function countColleaguesOnLeave(date, schedule, excludeDoctor) {
  return Object.values(
    Object.fromEntries(Object.entries(schedule).filter(([name]) => name !== excludeDoctor))
  ).filter(days => days[date] && LEAVE_CODES.has(days[date].shift)).length
}

export function calculateLeaveEligibility(doctor, schedule, today) {
  const doctorSchedule = schedule[doctor] || {}
  const todayMs = new Date(today + 'T00:00:00').getTime()
  const cutoffMs = todayMs + 42 * 24 * 60 * 60 * 1000

  return Object.entries(doctorSchedule)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { shift }]) => {
      const shiftTime = shift || ''

      // Empty cell (day off) or existing leave code — not a requestable shift
      if (shiftTime === '' || LEAVE_CODES.has(shiftTime)) {
        return { date, shiftTime, eligible: false, reason: null, isDayOff: true }
      }

      const dateMs = new Date(date + 'T00:00:00').getTime()

      // Past date
      if (dateMs < todayMs) {
        return { date, shiftTime, eligible: false, reason: 'This date has already passed. Therefore annual leave cannot be booked.', isDayOff: false }
      }

      // Condition 1: at least 42 days from today
      if (dateMs < cutoffMs) {
        return { date, shiftTime, eligible: false, reason: 'This date is fewer than 6 weeks away.', isDayOff: false }
      }

      // Condition 2: not a night shift
      if (isNightShift(shiftTime)) {
        return { date, shiftTime, eligible: false, reason: 'No leave can be requested on night shifts.', isDayOff: false }
      }

      // Condition 3: not a weekend (computed from date, not spreadsheet column)
      if (isWeekend(date)) {
        return { date, shiftTime, eligible: false, reason: 'No leave can be requested on weekends.', isDayOff: false }
      }

      // Condition 4: fewer than 6 colleagues on leave on this date
      const colleaguesOnLeave = countColleaguesOnLeave(date, schedule, doctor)
      if (colleaguesOnLeave >= 6) {
        return {
          date, shiftTime, eligible: false,
          reason: `${colleaguesOnLeave} of your colleagues are already on leave on this date.`,
          isDayOff: false,
        }
      }

      return { date, shiftTime, eligible: true, reason: null, isDayOff: false }
    })
}
