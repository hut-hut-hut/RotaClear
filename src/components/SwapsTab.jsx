import { useState, useMemo, useRef, useEffect } from 'react'
import { getDoctorShifts, calculateValidSwapsForDate, buildPrecomputed } from '../lib/swapRules.js'
import EmailModal from './EmailModal.jsx'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatMonthHeader(year, month) {
  return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

function monthAbbr(year, month) {
  return new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short' }) + " '" + String(year).slice(2)
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function ShiftCalendar({ year, month, shiftMap, swappableMap, today, onDayClick, sectionRef }) {
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
          const shift = shiftMap[isoDate]
          const isPast = isoDate < today

          if (!shift) {
            return (
              <div key={isoDate} className="min-h-[52px] rounded-lg p-1 flex flex-col items-center bg-white border border-gray-100">
                <span className="text-xs text-gray-300">{dayNum}</span>
              </div>
            )
          }

          if (isPast) {
            return (
              <div key={isoDate} className="min-h-[52px] rounded-lg p-1 flex flex-col items-center bg-gray-50 border border-gray-200">
                <span className="text-xs font-medium text-gray-400">{dayNum}</span>
                <span className="text-[9px] leading-tight text-center mt-0.5 break-all text-gray-400">{shift}</span>
              </div>
            )
          }

          const canSwap = swappableMap[isoDate]

          if (canSwap) {
            return (
              <div
                key={isoDate}
                onClick={() => onDayClick(isoDate)}
                className="min-h-[52px] rounded-lg p-1 flex flex-col items-center cursor-pointer transition-colors bg-green-50 border border-green-200 hover:bg-green-100"
              >
                <span className="text-xs font-semibold text-green-700">{dayNum}</span>
                <span className="text-[9px] leading-tight text-center mt-0.5 break-all text-green-500">{shift}</span>
              </div>
            )
          }

          return (
            <div key={isoDate} className="min-h-[52px] rounded-lg p-1 flex flex-col items-center bg-pink-50 border border-pink-200">
              <span className="text-xs font-semibold text-pink-400">{dayNum}</span>
              <span className="text-[9px] leading-tight text-center mt-0.5 break-all text-pink-300">{shift}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SwapsTab({ selectedDoctor, rotaData, isActive }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [emailSwap, setEmailSwap] = useState(null)
  const monthRefs = useRef({})

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const precomputed = useMemo(() => buildPrecomputed(rotaData.schedule), [rotaData])

  const myShifts = useMemo(
    () => getDoctorShifts(selectedDoctor, rotaData.schedule),
    [selectedDoctor, rotaData]
  )

  const shiftMap = useMemo(() => {
    const map = {}
    for (const { date, shift } of myShifts) map[date] = shift
    return map
  }, [myShifts])

  const swappableMap = useMemo(() => {
    const map = {}
    for (const { date } of myShifts) {
      if (date > today) {
        const results = calculateValidSwapsForDate(selectedDoctor, rotaData.schedule, date, precomputed)
        map[date] = results.length > 0
      }
    }
    return map
  }, [myShifts, today, selectedDoctor, rotaData.schedule, precomputed])

  const monthGroups = useMemo(() => {
    if (!rotaData.rotaStart || !rotaData.rotaEnd) return []
    const [sy, sm] = rotaData.rotaStart.split('-').map(Number)
    const [ey, em] = rotaData.rotaEnd.split('-').map(Number)
    const groups = []
    let y = sy, m = sm
    while (y < ey || (y === ey && m <= em)) {
      groups.push({ year: y, month: m })
      m++
      if (m > 12) { m = 1; y++ }
    }
    return groups
  }, [rotaData])

  // Scroll to current month whenever this tab becomes active (Phase 1 only)
  useEffect(() => {
    if (!isActive || selectedDate) return
    setTimeout(() => {
      const [ty, tm] = today.split('-').map(Number)
      const target = monthGroups.find(({ year, month }) =>
        year > ty || (year === ty && month >= tm)
      ) || monthGroups[0]
      if (!target) return
      const key = `${target.year}-${target.month}`
      const el = monthRefs.current[key]
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY - 160
      window.scrollTo({ top, behavior: 'smooth' })
    }, 150)
  }, [isActive, monthGroups])

  const swaps = useMemo(
    () => selectedDate ? calculateValidSwapsForDate(selectedDoctor, rotaData.schedule, selectedDate, precomputed) : null,
    [selectedDoctor, rotaData, selectedDate, precomputed]
  )

  function handleSelectDate(date) {
    setSelectedDate(date)
    setExpandedIndex(null)
    setEmailSwap(null)
  }

  function handleBack() {
    setSelectedDate(null)
    setExpandedIndex(null)
    setEmailSwap(null)
  }

  // Phase 1: calendar
  if (!selectedDate) {
    return (
      <div className="flex gap-6 max-w-3xl">
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          {/* Sticky colour key */}
          <div className="sticky top-[84px] z-[5] bg-white pb-3 mb-3 border-b border-gray-100">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-12 rounded-lg bg-green-50 border border-green-200 flex flex-col items-center justify-center px-1">
                  <span className="text-[10px] font-semibold text-green-700 leading-none">15</span>
                  <span className="text-[9px] text-green-500 leading-tight mt-0.5 text-center">0800-1800</span>
                </div>
                <span className="text-sm text-gray-600">Can swap — click to see colleagues</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-12 rounded-lg bg-pink-50 border border-pink-200 flex flex-col items-center justify-center px-1">
                  <span className="text-[10px] font-semibold text-pink-400 leading-none">15</span>
                  <span className="text-[9px] text-pink-300 leading-tight mt-0.5 text-center">0800-1800</span>
                </div>
                <span className="text-sm text-gray-600">No valid swap</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-12 rounded-lg bg-gray-50 border border-gray-200 flex flex-col items-center justify-center px-1">
                  <span className="text-[10px] font-medium text-gray-400 leading-none">15</span>
                  <span className="text-[9px] text-gray-400 leading-tight mt-0.5 text-center">0800-1800</span>
                </div>
                <span className="text-sm text-gray-600">Past shift</span>
              </div>
            </div>
          </div>

          {monthGroups.map(({ year, month }) => (
            <ShiftCalendar
              key={`${year}-${month}`}
              year={year}
              month={month}
              shiftMap={shiftMap}
              swappableMap={swappableMap}
              today={today}
              onDayClick={handleSelectDate}
              sectionRef={el => { monthRefs.current[`${year}-${month}`] = el }}
            />
          ))}
        </div>

        {/* Sticky month sidebar */}
        <div className="w-20 shrink-0">
          <div className="sticky top-24 flex flex-col gap-1">
            {monthGroups.map(({ year, month }) => (
              <button
                key={`${year}-${month}`}
                onClick={() => {
                  const el = monthRefs.current[`${year}-${month}`]
                  if (!el) return
                  const top = el.getBoundingClientRect().top + window.scrollY - 160
                  window.scrollTo({ top, behavior: 'smooth' })
                }}
                className="text-xs font-medium text-gray-500 hover:text-pink-500 hover:bg-pink-50 rounded-lg px-2 py-2 text-center transition-colors"
              >
                {monthAbbr(year, month)}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Phase 2: swap partners for selected shift
  const selectedShift = shiftMap[selectedDate] ?? ''

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={handleBack}
        className="text-sm text-pink-500 hover:text-pink-600 mb-4 flex items-center gap-1"
      >
        ← Change shift
      </button>

      <p className="text-gray-700 font-medium mb-1">
        {formatDate(selectedDate)} — {selectedShift}
      </p>
      <p className="text-sm text-gray-400 mb-4">Valid swap partners:</p>

      {swaps.length === 0 ? (
        <div>
          <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-600 space-y-2 mb-5">
            <p className="font-medium text-gray-700 mb-1">No valid swaps found. Fatigue rules that must be satisfied:</p>
            <p>• No fewer than 11 hours between any two consecutive shifts</p>
            <p>• No fewer than 48 hours after a run of night shifts</p>
            <p>• No more than 7 consecutive shifts in a row</p>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            If you believe a swap should be possible, contact your rota coordinator directly at{' '}
            <span className="font-medium text-gray-700">imperial.smhed-shorota@nhs.net</span>.
            Remember, this website can make mistakes — always double-check with your rota coordinator.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {swaps.map((swap, i) => (
            <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{swap.partnerName}</span>
                  <span className="text-sm text-gray-500">{formatDate(swap.partnerDate)}</span>
                  <span className="text-sm text-gray-400">{swap.partnerShift}</span>
                </div>
                <span className="text-gray-300 text-xs ml-2 shrink-0">
                  {expandedIndex === i ? '▲' : '▼'}
                </span>
              </button>

              {expandedIndex === i && (
                <div className="px-4 pb-4 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-600 mb-3">
                    Please talk to this person to arrange the swap before reaching out to the Rota Coordinator.
                  </p>
                  <button
                    onClick={() => setEmailSwap(swap)}
                    className="px-4 py-2 text-sm bg-pink-500 hover:bg-pink-600 text-white rounded-xl transition-colors"
                  >
                    Generate email draft
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {emailSwap && (
        <EmailModal
          swap={emailSwap}
          selectedDoctor={selectedDoctor}
          onClose={() => setEmailSwap(null)}
        />
      )}
    </div>
  )
}
