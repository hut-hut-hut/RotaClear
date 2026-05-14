import { useState, useMemo, useEffect } from 'react'
import { calculateLeaveEligibility } from '../lib/leaveRules.js'
import DayPopup from './DayPopup.jsx'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatMonthHeader(year, month) {
  return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

function monthAbbr(year, month) {
  return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short' }) + ' ' + String(year)
}

function MonthCalendar({ year, month, dayMap, Today, onDayClick, lastDate }) {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map(label => (
          <div key={label} className="text-center text-[11px] text-gray-400 font-medium py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startOffset }, (_, i) => (
          <div key={`pad-${i}`} className="h-[calc((100vh-17rem)/6)]" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1
          const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
          if (lastDate && isoDate > lastDate) {
            return <div key={isoDate} className="h-[calc((100vh-17rem)/6)]" />
          }

          const day = dayMap[isoDate]
          if (!day) {
            return <div key={isoDate} className="h-[calc((100vh-17rem)/6)]" />
          }

          const { eligible, shiftTime, isDayOff, isWithin6Weeks } = day
          const isToday = isoDate === Today
          const isPast = isoDate < Today

          const bgClass = isToday || isPast
            ? 'bg-white border border-gray-100'
            : eligible
            ? 'bg-green-50 border border-green-200 hover:bg-green-100'
            : isWithin6Weeks
            ? 'bg-yellow-50 border border-yellow-300 hover:bg-yellow-100'
            : isDayOff
            ? 'bg-white border border-gray-100'
            : 'bg-red-50 border border-red-200 hover:bg-red-100'

          const numClass = isPast
            ? 'text-gray-300 font-medium'
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

          return (
            <div
              key={isoDate}
              className={`h-[calc((100vh-17rem)/6)] rounded-lg p-1 flex flex-col items-center cursor-pointer transition-all ${bgClass} ${isFuture ? 'hover:shadow-md hover:-translate-y-0.5' : ''}`}
              onClick={() => onDayClick(day)}
            >
              {isToday ? (
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center mt-0.5">
                  <span className="text-sm font-bold text-white">{dayNum}</span>
                </div>
              ) : (
                <span className={`text-sm ${numClass}`}>{dayNum}</span>
              )}
              {!isToday && !isPast && shiftTime && !isDayOff && (
                <span className={`text-sm leading-tight text-center mt-0.5 break-all ${timeClass}`}>
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
  const [showMonthDropdown, setShowMonthDropdown] = useState(false)
  const [currentMonthIdx, setCurrentMonthIdx] = useState(0)
  const isWaterCoordinator = selectedDoctor?.toLowerCase().includes('water coordinator')

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

  // Jump to the current month when data loads
  useEffect(() => {
    if (!monthGroups.length) return
    const [ty, tm] = Today.split('-').map(Number)
    const idx = monthGroups.findIndex(({ year, month }) =>
      year > ty || (year === ty && month >= tm)
    )
    setCurrentMonthIdx(idx >= 0 ? idx : 0)
  }, [monthGroups])

  const hasEligible = days.some(d => d.eligible)
  const currentMonth = monthGroups[currentMonthIdx]

  function handleGoToRules() {
    setSelectedDay(null)
    if (onGoToRules) onGoToRules()
  }

  return (
    <div className="flex gap-8">
      {/* Left sidebar: key + month dropdown */}
      <div className="w-44 shrink-0">
        <div className="sticky top-[140px] flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-sm bg-green-50 border border-green-200 shrink-0" />
              <span className="text-xs text-gray-600">Eligible for leave</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-sm bg-yellow-50 border border-yellow-300 shrink-0" />
              <span className="text-xs text-gray-600">Within next 6 weeks</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-sm bg-red-50 border border-red-200 shrink-0" />
              <span className="text-xs text-gray-600">Not eligible</span>
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowMonthDropdown(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-100 hover:border-gray-400 transition-colors"
            >
              Month
              <span className="text-[10px]">{showMonthDropdown ? '▲' : '▼'}</span>
            </button>
            {showMonthDropdown && (
              <div className="mt-2 flex flex-col gap-0.5">
                {monthGroups.map(({ year, month }, idx) => {
                  const [ty, tm] = Today.split('-').map(Number)
                  if (year < ty || (year === ty && month < tm)) return null
                  return (
                    <button
                      key={`${year}-${month}`}
                      onClick={() => { setCurrentMonthIdx(idx); setShowMonthDropdown(false) }}
                      className={`text-xs text-left rounded-lg px-2 py-1.5 transition-colors ${
                        idx === currentMonthIdx
                          ? 'text-pink-500 bg-pink-50 font-semibold'
                          : 'text-gray-500 hover:text-pink-500 hover:bg-pink-50'
                      }`}
                    >
                      {monthAbbr(year, month)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Single-month calendar */}
      <div className="flex-1 min-w-0">
        {!hasEligible && days.length > 0 && (
          <p className="text-sm text-gray-400 mb-4">No available dates to request for leave.</p>
        )}

        {currentMonth && (
          <>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentMonthIdx(i => Math.max(0, i - 1))}
                disabled={currentMonthIdx === 0}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-3xl leading-none"
              >
                ‹
              </button>
              <h2 className="text-base font-semibold text-gray-800">
                {formatMonthHeader(currentMonth.year, currentMonth.month)}
              </h2>
              <button
                onClick={() => setCurrentMonthIdx(i => Math.min(monthGroups.length - 1, i + 1))}
                disabled={currentMonthIdx === monthGroups.length - 1}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-3xl leading-none"
              >
                ›
              </button>
            </div>

            <MonthCalendar
              year={currentMonth.year}
              month={currentMonth.month}
              dayMap={dayMap}
              Today={Today}
              onDayClick={setSelectedDay}
              lastDate={lastShiftDate}
            />
          </>
        )}
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
