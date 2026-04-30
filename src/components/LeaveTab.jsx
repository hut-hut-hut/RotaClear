import { useState, useMemo, useRef, useEffect } from 'react'
import { calculateLeaveEligibility } from '../lib/leaveRules.js'
import DayPopup from './DayPopup.jsx'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatMonthHeader(year, month) {
  return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

function monthAbbr(year, month) {
  return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short' }) + " '" + String(year).slice(2)
}

function MonthCalendar({ year, month, dayMap, Today, onDayClick, sectionRef, lastDate }) {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7

  return (
    <div className="mb-8" ref={sectionRef}>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        {formatMonthHeader(year, month)}
      </h3>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map(label => (
          <div key={label} className="text-center text-[11px] text-gray-400 font-medium py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startOffset }, (_, i) => (
          <div key={`pad-${i}`} className="min-h-[52px]" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1
          const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
          if (lastDate && isoDate > lastDate) {
            return <div key={isoDate} className="min-h-[52px]" />
          }

          const day = dayMap[isoDate]

          if (!day) {
            return <div key={isoDate} className="min-h-[52px]" />
          }

          const { eligible, shiftTime, isDayOff, isWithin6Weeks } = day
          const isToday = isoDate === Today
          const isPast = isoDate < Today

          const bgClass = isToday
            ? 'bg-blue-50 border border-blue-400 hover:bg-blue-100'
            : isPast
            ? isDayOff ? 'bg-white border border-gray-100' : 'bg-gray-50 border border-gray-200'
            : eligible
            ? 'bg-green-50 border border-green-200 hover:bg-green-100'
            : isWithin6Weeks
            ? 'bg-yellow-50 border border-yellow-300 hover:bg-yellow-100'
            : isDayOff
            ? 'bg-white border border-gray-100'
            : 'bg-red-50 border border-red-200 hover:bg-red-100'

          const numClass = isToday
            ? 'text-blue-700 font-bold'
            : isPast
            ? 'text-gray-400 font-medium'
            : eligible
            ? 'text-green-700 font-semibold'
            : isWithin6Weeks
            ? 'text-yellow-700 font-semibold'
            : isDayOff
            ? 'text-gray-300 font-medium'
            : 'text-red-600 font-semibold'

          const timeClass = isToday
            ? 'text-blue-400'
            : isPast
            ? 'text-gray-400'
            : eligible
            ? 'text-green-500'
            : isWithin6Weeks
            ? 'text-yellow-500'
            : 'text-red-400'

          const isFuture = !isToday && !isPast

          const plusClass = eligible
            ? 'text-green-700'
            : isWithin6Weeks
            ? 'text-yellow-700'
            : isDayOff
            ? 'text-gray-400'
            : 'text-red-600'

          return (
            <div
              key={isoDate}
              className={`relative min-h-[52px] rounded-lg p-1 flex flex-col items-center cursor-pointer transition-all group ${bgClass} ${isFuture ? 'hover:shadow-md hover:-translate-y-0.5' : ''}`}
              onClick={() => onDayClick(day)}
            >
              {isFuture && (
                <span className={`absolute top-0.5 right-0.5 text-[9px] font-bold ${plusClass} opacity-0 group-hover:opacity-70 transition-opacity leading-none select-none`}>+</span>
              )}
              <span className={`text-xs ${numClass}`}>{dayNum}</span>
              {isToday && (
                <span className="text-[9px] leading-tight text-center mt-0.5 text-blue-400 font-medium">Today</span>
              )}
              {!isToday && shiftTime && !isDayOff && (
                <span className={`text-[9px] leading-tight text-center mt-0.5 break-all ${timeClass}`}>
                  {shiftTime}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function LeaveTab({ selectedDoctor, rotaData, isActive, onGoToRules }) {
  const [selectedDay, setSelectedDay] = useState(null)
  const [activeMonthKey, setActiveMonthKey] = useState(null)
  const isWaterCoordinator = selectedDoctor?.toLowerCase().includes('water coordinator')
  const monthRefs = useRef({})

  const Today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const days = useMemo(() => {
    if (!rotaData || !selectedDoctor) return []
    return calculateLeaveEligibility(selectedDoctor, rotaData.schedule, Today)
  }, [rotaData, selectedDoctor, Today])

  const dayMap = useMemo(() => {
    const map = {}
    for (const d of days) map[d.date] = d
    return map
  }, [days])

  const lastShiftDate = useMemo(() => {
    if (!days.length) return null
    return days.reduce((max, d) => d.date > max ? d.date : max, days[0].date)
  }, [days])

  const monthGroups = useMemo(() => {
    const keys = new Set()
    for (const d of days) {
      const [y, m] = d.date.split('-')
      keys.add(`${y}-${m}`)
    }
    return [...keys].sort().map(key => {
      const [y, m] = key.split('-')
      return { year: parseInt(y, 10), month: parseInt(m, 10) }
    })
  }, [days])

  // Track which month is closest to the viewport centre
  useEffect(() => {
    function updateActive() {
      const mid = window.scrollY + window.innerHeight / 2
      let best = null, bestDist = Infinity
      for (const [key, el] of Object.entries(monthRefs.current)) {
        if (!el) continue
        const top = el.getBoundingClientRect().top + window.scrollY
        const center = top + el.offsetHeight / 2
        const dist = Math.abs(center - mid)
        if (dist < bestDist) { bestDist = dist; best = key }
      }
      setActiveMonthKey(best)
    }
    window.addEventListener('scroll', updateActive, { passive: true })
    updateActive()
    return () => window.removeEventListener('scroll', updateActive)
  }, [monthGroups])

  // Scroll to first month >= Today whenever this tab becomes active
  useEffect(() => {
    if (!isActive) return
    setTimeout(() => {
      const [ty, tm] = Today.split('-').map(Number)
      const target = monthGroups.find(({ year, month }) =>
        year > ty || (year === ty && month >= tm)
      ) || monthGroups[0]
      if (!target) return
      const key = `${target.year}-${target.month}`
      const el = monthRefs.current[key]
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY - 200
      window.scrollTo({ top, behavior: 'smooth' })
    }, 150)
  }, [isActive, monthGroups])

  const hasEligible = days.some(d => d.eligible)

  function handleGoToRules() {
    setSelectedDay(null)
    if (onGoToRules) onGoToRules()
  }

  return (
    <div className="flex gap-6 max-w-3xl mx-auto">
      {/* Calendar */}
      <div className="flex-1 min-w-0">
        {/* Sticky color key */}
        <div className="sticky top-[121px] z-[5] bg-white pb-3 mb-3 border-b border-gray-100">
          <div className="flex gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-10 h-12 rounded-lg bg-green-50 border border-green-200 flex flex-col items-center justify-center px-1">
                <span className="text-[10px] font-semibold text-green-700 leading-none">15</span>
                <span className="text-[9px] text-green-500 leading-tight mt-0.5 text-center">08:00-18:00</span>
              </div>
              <span className="text-sm text-gray-600">Eligible for leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-12 rounded-lg bg-yellow-50 border border-yellow-300 flex flex-col items-center justify-center px-1">
                <span className="text-[10px] font-semibold text-yellow-700 leading-none">15</span>
                <span className="text-[9px] text-yellow-500 leading-tight mt-0.5 text-center">08:00-18:00</span>
              </div>
              <span className="text-sm text-gray-600">Within next 6 weeks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-12 rounded-lg bg-red-50 border border-red-200 flex flex-col items-center justify-center px-1">
                <span className="text-[10px] font-semibold text-red-600 leading-none">15</span>
                <span className="text-[9px] text-red-400 leading-tight mt-0.5 text-center">08:00-18:00</span>
              </div>
              <span className="text-sm text-gray-600">Not eligible</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-12 rounded-lg bg-gray-50 border border-gray-200 flex flex-col items-center justify-center px-1">
                <span className="text-[10px] font-medium text-gray-400 leading-none">15</span>
                <span className="text-[9px] text-gray-400 leading-tight mt-0.5 text-center">08:00-18:00</span>
              </div>
              <span className="text-sm text-gray-600">Past shift</span>
            </div>
          </div>
        </div>

        {!hasEligible && days.length > 0 && (
          <p className="text-sm text-gray-400 mb-6">No available dates to request for leave.</p>
        )}

        {monthGroups.map(({ year, month }) => (
          <MonthCalendar
            key={`${year}-${month}`}
            year={year}
            month={month}
            dayMap={dayMap}
            Today={Today}
            onDayClick={setSelectedDay}
            lastDate={lastShiftDate}
            sectionRef={el => { monthRefs.current[`${year}-${month}`] = el }}
          />
        ))}
      </div>

      {/* Sticky month sidebar */}
      <div className="w-20 shrink-0">
        <div className="sticky top-[140px] flex flex-col gap-1">
          {monthGroups.map(({ year, month }) => {
            const key = `${year}-${month}`
            return (
              <button
                key={key}
                onClick={() => {
                  const el = monthRefs.current[key]
                  if (!el) return
                  const top = el.getBoundingClientRect().top + window.scrollY - 200
                  window.scrollTo({ top, behavior: 'smooth' })
                }}
                className={`text-xs font-medium rounded-lg px-2 py-2 text-center transition-colors ${
                  activeMonthKey === key
                    ? 'text-pink-500 bg-pink-50 font-semibold'
                    : 'text-gray-500 hover:text-pink-500 hover:bg-pink-50'
                }`}
              >
                {monthAbbr(year, month)}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDay && (
        <DayPopup
          day={selectedDay}
          selectedDoctor={selectedDoctor}
          isWaterCoordinator={isWaterCoordinator}
          onClose={() => setSelectedDay(null)}
          onGoToRules={handleGoToRules}
        />
      )}
    </div>
  )
}
