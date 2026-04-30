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

function NoShiftPopup({ isoDate, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs text-gray-400">{formatDate(isoDate)}</p>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 text-2xl leading-none ml-4 -mt-1"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-500">No shift scheduled.</p>
      </div>
    </div>
  )
}

function FatiguePopup({ onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-gray-800 font-medium mb-2">This shift cannot be swapped</p>
        <p className="text-sm text-gray-500 mb-4">
          One or more of the following fatigue rules would be violated:
        </p>
        <ul className="text-sm text-gray-700 space-y-2 list-disc list-outside pl-4">
          <li>No fewer than 11 hours between any two consecutive shifts</li>
          <li>No fewer than 48 hours after a run of night shifts</li>
          <li>No more than 7 consecutive shifts in a row</li>
        </ul>
        <button
          onClick={onClose}
          className="mt-5 w-full px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}

function ShiftCalendar({ year, month, shiftMap, swappableMap, Today, onSwapClick, onNoSwapClick, onNoShiftClick, sectionRef, lastDate }) {
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
          const isPast = isoDate < Today
          const isToday = isoDate === Today

          if (lastDate && isoDate > lastDate) {
            return <div key={isoDate} className="min-h-[52px]" />
          }

          if (!shift) {
            const isFutureEmpty = !isToday && !isPast
            return (
              <div
                key={isoDate}
                onClick={isFutureEmpty ? () => onNoShiftClick(isoDate) : undefined}
                className={`relative min-h-[52px] rounded-lg p-1 flex flex-col items-center ${isToday ? 'bg-blue-50 border border-blue-400' : 'bg-white border border-gray-100'} ${isFutureEmpty ? 'cursor-pointer transition-all group hover:shadow-md hover:-translate-y-0.5' : ''}`}
              >
                {isFutureEmpty && (
                  <span className="absolute top-0.5 right-0.5 text-[9px] font-bold text-gray-400 opacity-0 group-hover:opacity-70 transition-opacity leading-none select-none">+</span>
                )}
                <span className={`text-xs font-medium ${isToday ? 'font-bold text-blue-700' : 'text-gray-300'}`}>{dayNum}</span>
                {isToday && <span className="text-[9px] leading-tight text-center mt-0.5 text-blue-400 font-medium">Today</span>}
              </div>
            )
          }

          if (isToday) {
            return (
              <div key={isoDate} className="min-h-[52px] rounded-lg p-1 flex flex-col items-center bg-blue-50 border border-blue-400">
                <span className="text-xs font-bold text-blue-700">{dayNum}</span>
                <span className="text-[9px] leading-tight text-center mt-0.5 text-blue-400 font-medium">Today</span>
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
                onClick={() => onSwapClick(isoDate)}
                className="relative min-h-[52px] rounded-lg p-1 flex flex-col items-center cursor-pointer transition-all group bg-green-50 border border-green-200 hover:bg-green-100 hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="absolute top-0.5 right-0.5 text-[9px] font-bold text-green-700 opacity-0 group-hover:opacity-70 transition-opacity leading-none select-none">+</span>
                <span className="text-xs font-semibold text-green-700">{dayNum}</span>
                <span className="text-[9px] leading-tight text-center mt-0.5 break-all text-green-500">{shift}</span>
              </div>
            )
          }

          return (
            <div
              key={isoDate}
              onClick={() => onNoSwapClick(isoDate)}
              className="relative min-h-[52px] rounded-lg p-1 flex flex-col items-center cursor-pointer transition-all group bg-red-50 border border-red-200 hover:bg-red-100 hover:shadow-md hover:-translate-y-0.5"
            >
              <span className="absolute top-0.5 right-0.5 text-[9px] font-bold text-red-600 opacity-0 group-hover:opacity-70 transition-opacity leading-none select-none">+</span>
              <span className="text-xs font-semibold text-red-600">{dayNum}</span>
              <span className="text-[9px] leading-tight text-center mt-0.5 break-all text-red-400">{shift}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PartnerCalendar({ year, month, partnerSwapsMap, Today, onPartnerClick, sectionRef, lastDate }) {
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

          const isToday = isoDate === Today
          const swapsOnDate = partnerSwapsMap[isoDate]
          const isPartner = swapsOnDate && swapsOnDate.length > 0

          if (isToday) {
            return (
              <div key={isoDate} className="min-h-[52px] rounded-lg p-1 flex flex-col items-center bg-blue-50 border border-blue-400">
                <span className="text-xs font-bold text-blue-700">{dayNum}</span>
                <span className="text-[9px] leading-tight text-center mt-0.5 text-blue-400 font-medium">Today</span>
              </div>
            )
          }

          if (isPartner) {
            return (
              <div
                key={isoDate}
                onClick={() => onPartnerClick(isoDate)}
                className="relative min-h-[52px] rounded-lg p-1 flex flex-col items-center cursor-pointer transition-all group bg-green-50 border border-green-200 hover:bg-green-100 hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="absolute top-0.5 right-0.5 text-[9px] font-bold text-green-700 opacity-0 group-hover:opacity-70 transition-opacity leading-none select-none">+</span>
                <span className="text-xs font-semibold text-green-700">{dayNum}</span>
                <span className="text-[9px] leading-tight text-center mt-0.5 text-green-500">
                  {swapsOnDate.length} option{swapsOnDate.length !== 1 ? 's' : ''}
                </span>
              </div>
            )
          }

          return (
            <div key={isoDate} className="min-h-[52px] rounded-lg p-1 flex flex-col items-center bg-white border border-gray-100">
              <span className="text-xs text-gray-300">{dayNum}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SwapsTab({ selectedDoctor, rotaData, isActive }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedPartnerDate, setSelectedPartnerDate] = useState(null)
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [emailSwap, setEmailSwap] = useState(null)
  const [showFatiguePopup, setShowFatiguePopup] = useState(false)
  const [noShiftDate, setNoShiftDate] = useState(null)
  const [activeMonthKey, setActiveMonthKey] = useState(null)
  const [activePartnerMonthKey, setActivePartnerMonthKey] = useState(null)
  const monthRefs = useRef({})
  const partnerMonthRefs = useRef({})

  const Today = useMemo(() => {
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
      if (date > Today) {
        const results = calculateValidSwapsForDate(selectedDoctor, rotaData.schedule, date, precomputed)
        map[date] = results.length > 0
      }
    }
    return map
  }, [myShifts, Today, selectedDoctor, rotaData.schedule, precomputed])

  const lastShiftDate = useMemo(() => {
    if (!myShifts.length) return null
    return myShifts.reduce((max, s) => s.date > max ? s.date : max, myShifts[0].date)
  }, [myShifts])

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

  const swaps = useMemo(
    () => selectedDate ? calculateValidSwapsForDate(selectedDoctor, rotaData.schedule, selectedDate, precomputed) : null,
    [selectedDoctor, rotaData, selectedDate, precomputed]
  )

  const partnerSwapsMap = useMemo(() => {
    if (!swaps) return {}
    const map = {}
    for (const swap of swaps) {
      if (!map[swap.partnerDate]) map[swap.partnerDate] = []
      map[swap.partnerDate].push(swap)
    }
    return map
  }, [swaps])

  const partnerMonthGroups = useMemo(() => {
    if (!swaps || !swaps.length) return []
    const keys = new Set()
    for (const swap of swaps) {
      const [y, m] = swap.partnerDate.split('-')
      keys.add(`${y}-${m}`)
    }
    return [...keys].sort().map(key => {
      const [y, m] = key.split('-')
      return { year: parseInt(y, 10), month: parseInt(m, 10) }
    })
  }, [swaps])

  // Track which month is closest to viewport centre — Phase 1
  useEffect(() => {
    if (selectedDate) return
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
  }, [monthGroups, selectedDate])

  // Track which partner month is closest to viewport centre — Phase 2
  useEffect(() => {
    if (!selectedDate || selectedPartnerDate) return
    function updateActive() {
      const mid = window.scrollY + window.innerHeight / 2
      let best = null, bestDist = Infinity
      for (const [key, el] of Object.entries(partnerMonthRefs.current)) {
        if (!el) continue
        const top = el.getBoundingClientRect().top + window.scrollY
        const center = top + el.offsetHeight / 2
        const dist = Math.abs(center - mid)
        if (dist < bestDist) { bestDist = dist; best = key }
      }
      setActivePartnerMonthKey(best)
    }
    window.addEventListener('scroll', updateActive, { passive: true })
    updateActive()
    return () => window.removeEventListener('scroll', updateActive)
  }, [partnerMonthGroups, selectedDate, selectedPartnerDate])

  // Scroll to current month in Phase 1 whenever tab becomes active
  useEffect(() => {
    if (!isActive || selectedDate) return
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

  function handleSelectDate(date) {
    setSelectedDate(date)
    setSelectedPartnerDate(null)
    setExpandedIndex(null)
    setEmailSwap(null)
    window.scrollTo(0, 0)
  }

  function handleBack() {
    setSelectedDate(null)
    setSelectedPartnerDate(null)
    setExpandedIndex(null)
    setEmailSwap(null)
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
  }

  function handleSelectPartnerDate(date) {
    setSelectedPartnerDate(date)
    setExpandedIndex(null)
    setEmailSwap(null)
    window.scrollTo(0, 0)
  }

  function handleBackToCalendar() {
    setSelectedPartnerDate(null)
    setExpandedIndex(null)
    setEmailSwap(null)
  }

  // Phase 1: my shifts calendar
  if (!selectedDate) {
    return (
      <div className="flex gap-6 max-w-3xl">
        <div className="flex-1 min-w-0">
          <div className="sticky top-[121px] z-[5] bg-white pb-3 mb-3 border-b border-gray-100">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-12 rounded-lg bg-green-50 border border-green-200 flex flex-col items-center justify-center px-1">
                  <span className="text-[10px] font-semibold text-green-700 leading-none">15</span>
                  <span className="text-[9px] text-green-500 leading-tight mt-0.5 text-center">0800-1800</span>
                </div>
                <span className="text-sm text-gray-600">Can swap — click to see options</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-12 rounded-lg bg-red-50 border border-red-200 flex flex-col items-center justify-center px-1">
                  <span className="text-[10px] font-semibold text-red-600 leading-none">15</span>
                  <span className="text-[9px] text-red-400 leading-tight mt-0.5 text-center">0800-1800</span>
                </div>
                <span className="text-sm text-gray-600">No valid swap — click for details</span>
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
              Today={Today}
              onSwapClick={handleSelectDate}
              onNoSwapClick={() => setShowFatiguePopup(true)}
              onNoShiftClick={setNoShiftDate}
              lastDate={lastShiftDate}
              sectionRef={el => { monthRefs.current[`${year}-${month}`] = el }}
            />
          ))}
        </div>

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

        {showFatiguePopup && <FatiguePopup onClose={() => setShowFatiguePopup(false)} />}
        {noShiftDate && <NoShiftPopup isoDate={noShiftDate} onClose={() => setNoShiftDate(null)} />}
      </div>
    )
  }

  const selectedShift = shiftMap[selectedDate] ?? ''

  // Phase 2: calendar of valid partner dates
  if (!selectedPartnerDate) {
    return (
      <div className="flex gap-6 max-w-3xl">
        <div className="flex-1 min-w-0">
          <div className="sticky top-[121px] z-[5] bg-white pb-3 mb-3 border-b border-gray-100">
            <button
              onClick={handleBack}
              className="text-sm text-pink-500 hover:text-pink-600 flex items-center gap-1 mb-3"
            >
              ← Change shift
            </button>
            <p className="text-sm font-medium text-gray-700 mb-0.5">
              {formatDate(selectedDate)} — {selectedShift}
            </p>
            <p className="text-sm text-gray-400 mb-3">Click a date to see who you can swap with</p>
            <div className="flex items-center gap-2">
              <div className="w-10 h-12 rounded-lg bg-green-50 border border-green-200 flex flex-col items-center justify-center px-1">
                <span className="text-[10px] font-semibold text-green-700 leading-none">15</span>
                <span className="text-[9px] text-green-500 leading-tight mt-0.5 text-center">2 options</span>
              </div>
              <span className="text-sm text-gray-600">Valid swap date</span>
            </div>
          </div>

          {partnerMonthGroups.map(({ year, month }) => (
            <PartnerCalendar
              key={`${year}-${month}`}
              year={year}
              month={month}
              partnerSwapsMap={partnerSwapsMap}
              Today={Today}
              onPartnerClick={handleSelectPartnerDate}
              lastDate={lastShiftDate}
              sectionRef={el => { partnerMonthRefs.current[`${year}-${month}`] = el }}
            />
          ))}
        </div>

        <div className="w-20 shrink-0">
          <div className="sticky top-[140px] flex flex-col gap-1">
            {partnerMonthGroups.map(({ year, month }) => {
              const key = `${year}-${month}`
              return (
                <button
                  key={key}
                  onClick={() => {
                    const el = partnerMonthRefs.current[key]
                    if (!el) return
                    const top = el.getBoundingClientRect().top + window.scrollY - 200
                    window.scrollTo({ top, behavior: 'smooth' })
                  }}
                  className={`text-xs font-medium rounded-lg px-2 py-2 text-center transition-colors ${
                    activePartnerMonthKey === key
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
      </div>
    )
  }

  // Phase 3: list of swap partners for the chosen partner date
  const partnersForDate = partnerSwapsMap[selectedPartnerDate] || []

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={handleBackToCalendar}
        className="text-sm text-pink-500 hover:text-pink-600 mb-4 flex items-center gap-1"
      >
        ← Back to calendar
      </button>

      <p className="text-gray-700 font-medium mb-0.5">
        Your shift: {formatDate(selectedDate)} — {selectedShift}
      </p>
      <p className="text-sm text-gray-500 mb-4">
        Colleagues available on {formatDate(selectedPartnerDate)}:
      </p>

      <div className="space-y-2">
        {partnersForDate.map((swap, i) => (
          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-gray-800">{swap.partnerName}</span>
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
