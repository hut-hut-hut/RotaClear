const LEAVE_CODES = new Set(['AL', 'SL', 'EDT', 'STT'])

export function calculateLeaveEligibility(doctor, schedule, today) {
  const doctorSchedule = schedule[doctor] || {}
  const todayMs = new Date(today + 'T00:00:00').getTime()
  const cutoffMs = todayMs + 42 * 24 * 60 * 60 * 1000

  return Object.entries(doctorSchedule)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { shift, day }]) => {
      const shiftTime = shift || ''

      // Empty cell (day off) or existing leave code — not a requestable shift
      if (shiftTime === '' || LEAVE_CODES.has(shiftTime)) {
        return { date, shiftTime, eligible: false, reason: null, isDayOff: true }
      }

      const dateMs = new Date(date + 'T00:00:00').getTime()

      // Condition 1: at least 42 days from today
      if (dateMs < cutoffMs) {
        return { date, shiftTime, eligible: false, reason: 'This date is fewer than 6 weeks away.', isDayOff: false }
      }

      // Condition 2: not a night shift
      if (shiftTime.startsWith('22:00')) {
        return { date, shiftTime, eligible: false, reason: 'No leave can be requested on night shifts.', isDayOff: false }
      }

      // Condition 3: not a weekend
      if (day === 'Saturday' || day === 'Sunday') {
        return { date, shiftTime, eligible: false, reason: 'No leave can be requested on weekends.', isDayOff: false }
      }

      // Condition 4 (colleague count) — implemented in step 8
      return { date, shiftTime, eligible: true, reason: null, isDayOff: false }
    })
}
