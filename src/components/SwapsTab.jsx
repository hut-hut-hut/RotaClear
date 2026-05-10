import { useState, useMemo, useEffect } from 'react'
import { getDoctorShifts, calculateValidSwapsForDate, buildPrecomputed, getShiftTime } from '../lib/swapRules.js'
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

function FatiguePopup({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <p className="text-gray-800 font-medium mb-2">This shift cannot be swapped</p>
        <p className="text-sm text-gray-500 mb-4">One or more of the following fatigue rules would be violated:</p>
        <ul className="text-sm text-gray-700 space-y-2 list-disc list-outside pl-4">
          <li>No fewer than 11 hours between any two consecutive shifts</li>
          <li>No fewer than 48 hours after a run of night shifts</li>
          <li>No more than 7 consecutive shifts in a row</li>
        </ul>
        <button onClick={onClose} className="mt-5 w-full px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}

function SwapOptionsModal({ partnersForDate, partnerDate, myDate, myShift, onClose, onEmailSwap }) {
  const [expandedIndex, setExpandedIndex] = useState(null)
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-sm font-medium text-gray-800">Your shift: {formatDate(myDate)} — {myShift}{getShiftTime(myShift) ? ` · ${getShiftTime(myShift)}` : ''}</p>
            <p className="text-xs text-gray-400 mt-1">Colleagues available on {formatDate(partnerDate)}</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-2xl leading-none ml-4 -mt-1">×</button>
        </div>
        <div className="space-y-2">
          {partnersForDate.map((swap, i) => (
            <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{swap.partnerName}</span>
                  <span className="text-sm text-gray-400">
                    {swap.partnerShift}{getShiftTime(swap.partnerShift) ? ` · ${getShiftTime(swap.partnerShift)}` : ''}
                  </span>
                </div>
                <span className="text-gray-300 text-xs ml-2 shrink-0">{expandedIndex === i ? '▲' : '▼'}</span>
              </button>
              {expandedIndex === i && (
                <div className="px-4 pb-4 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-600 mb-3">
                    Please talk to this person to arrange the swap before reaching out to the Rota Coordinator.
                  </p>
                  <button
                    onClick={() => onEmailSwap(swap)}
                    className="px-4 py-2 text-sm bg-pink-500 hover:bg-pink-600 text-white rounded-xl transition-colors"
                  >
                    Generate email draft
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SwapsCalendar({ year, month, shiftMap, swappableMap, partnerSwapsMap, selectedDate, Today, onShiftClick, onNoSwapClick, onPartnerClick, lastDate }) {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7
  const hasSelection = !!selectedDate

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map(label => (
          <div key={label} className="text-center text-[11px] text-gray-400 font-medium py-1">{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startOffset }, (_, i) => (
          <div key={`pad-${i}`} className="h-[calc((100vh-17rem)/6)]" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1
          const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
          const isPast = isoDate < Today
          const isToday = isoDate === Today
          const shift = shiftMap[isoDate]
          const isSelected = isoDate === selectedDate
          const partnerOptions = hasSelection ? (partnerSwapsMap[isoDate] ?? null) : null
          const isPartner = partnerOptions && partnerOptions.length > 0
          const canSwap = swappableMap[isoDate]

          if (lastDate && isoDate > lastDate) {
            return <div key={isoDate} className="h-[calc((100vh-17rem)/6)]" />
          }

          // Today
          if (isToday) {
            return (
              <div key={isoDate} className="h-[calc((100vh-17rem)/6)] rounded-lg p-1 flex flex-col items-center bg-white border border-gray-100 transition-all duration-200">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center mt-0.5">
                  <span className="text-sm font-bold text-white">{dayNum}</span>
                </div>
              </div>
            )
          }

          // Past
          if (isPast) {
            return (
              <div key={isoDate} className="h-[calc((100vh-17rem)/6)] rounded-lg p-1 flex flex-col items-center bg-white border border-gray-100 transition-all duration-200">
                <span className="text-sm font-medium text-gray-300">{dayNum}</span>
              </div>
            )
          }

          // Selected cell — highlighted blue
          if (isSelected) {
            return (
              <div
                key={isoDate}
                onClick={() => onShiftClick(isoDate)}
                className="h-[calc((100vh-17rem)/6)] rounded-lg p-1 flex flex-col items-center cursor-pointer transition-all duration-200 bg-gray-100 border-2 border-gray-300 shadow-md scale-[1.03]"
              >
                <span className="text-sm font-bold text-gray-700 mt-0.5">{dayNum}</span>
                <span className="text-xs leading-tight text-center mt-0.5 break-all text-gray-500">{shift}</span>
              </div>
            )
          }

          // Partner date — green, clickable
          if (isPartner) {
            return (
              <div
                key={isoDate}
                onClick={() => onPartnerClick(isoDate)}
                className="h-[calc((100vh-17rem)/6)] rounded-lg p-1 flex flex-col items-center cursor-pointer transition-all duration-200 bg-green-50 border border-green-200 hover:bg-green-100 hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="text-sm font-semibold text-green-700">{dayNum}</span>
                <span className="text-xs leading-tight text-center mt-0.5 text-green-500">
                  {partnerOptions.length} option{partnerOptions.length !== 1 ? 's' : ''}
                </span>
              </div>
            )
          }

          // No shift on this day
          if (!shift) {
            return (
              <div key={isoDate} className="h-[calc((100vh-17rem)/6)] rounded-lg p-1 flex flex-col items-center bg-white border border-gray-100 transition-all duration-200">
                <span className="text-sm font-medium text-gray-200">{dayNum}</span>
              </div>
            )
          }

          // Future shift, nothing selected → green/red
          if (!hasSelection) {
            if (canSwap) {
              return (
                <div
                  key={isoDate}
                  onClick={() => onShiftClick(isoDate)}
                  className="h-[calc((100vh-17rem)/6)] rounded-lg p-1 flex flex-col items-center cursor-pointer transition-all duration-200 bg-green-50 border border-green-200 hover:bg-green-100 hover:shadow-md hover:-translate-y-0.5"
                >
                  <span className="text-sm font-semibold text-green-700">{dayNum}</span>
                  <span className="text-sm leading-tight text-center mt-0.5 break-all text-green-500">{shift}</span>
                </div>
              )
            }
            return (
              <div
                key={isoDate}
                onClick={() => onNoSwapClick()}
                className="h-[calc((100vh-17rem)/6)] rounded-lg p-1 flex flex-col items-center cursor-pointer transition-all duration-200 bg-red-50 border border-red-200 hover:bg-red-100 hover:shadow-md hover:-translate-y-0.5"
              >
                <span className="text-sm font-semibold text-red-600">{dayNum}</span>
                <span className="text-sm leading-tight text-center mt-0.5 break-all text-red-400">{shift}</span>
              </div>
            )
          }

          // Future shift, something else selected → dimmed, still clickable to switch selection
          if (canSwap) {
            return (
              <div
                key={isoDate}
                onClick={() => onShiftClick(isoDate)}
                className="h-[calc((100vh-17rem)/6)] rounded-lg p-1 flex flex-col items-center cursor-pointer transition-all duration-200 bg-white border border-gray-100 hover:border-green-200 hover:bg-green-50"
              >
                <span className="text-sm font-medium text-gray-300">{dayNum}</span>
                <span className="text-xs leading-tight text-center mt-0.5 break-all text-gray-200">{shift}</span>
              </div>
            )
          }
          return (
            <div key={isoDate} className="h-[calc((100vh-17rem)/6)] rounded-lg p-1 flex flex-col items-center bg-white border border-gray-100 transition-all duration-200">
              <span className="text-sm font-medium text-gray-300">{dayNum}</span>
              <span className="text-xs leading-tight text-center mt-0.5 break-all text-gray-200">{shift}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SwapsTab({ selectedDoctor, rotaData, isActive }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [partnerPopupDate, setPartnerPopupDate] = useState(null)
  const [emailSwap, setEmailSwap] = useState(null)
  const [showFatiguePopup, setShowFatiguePopup] = useState(false)
  const [showMonthDropdown, setShowMonthDropdown] = useState(false)
  const [currentMonthIdx, setCurrentMonthIdx] = useState(0)

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

  useEffect(() => {
    if (!monthGroups.length) return
    const [ty, tm] = Today.split('-').map(Number)
    const idx = monthGroups.findIndex(({ year, month }) =>
      year > ty || (year === ty && month >= tm)
    )
    setCurrentMonthIdx(idx >= 0 ? idx : 0)
  }, [monthGroups])

  function handleShiftClick(date) {
    if (date === selectedDate) {
      setSelectedDate(null)
    } else if (swappableMap[date]) {
      setSelectedDate(date)
      setPartnerPopupDate(null)
    } else {
      setShowFatiguePopup(true)
    }
  }

  const currentMonth = monthGroups[currentMonthIdx]
  const selectedShift = selectedDate ? (shiftMap[selectedDate] ?? '') : ''

  return (
    <div className="flex gap-8">
      {/* Left sidebar */}
      <div className="w-44 shrink-0">
        <div className="sticky top-[140px] flex flex-col gap-6">

          {selectedDate ? (
            <>
              <div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-sm text-pink-500 hover:text-pink-600 flex items-center gap-1 mb-3 transition-colors"
                >
                  ← Clear selection
                </button>
                <p className="text-xs font-medium text-gray-700 leading-snug">{formatDate(selectedDate)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{selectedShift}</p>
                {swaps && swaps.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2">No valid swap partners found.</p>
                )}
                {swaps && swaps.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2">Navigate months to find swap partners.</p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-300 shrink-0" />
                  <span className="text-xs text-gray-600">Selected shift</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-sm bg-green-50 border border-green-200 shrink-0" />
                  <span className="text-xs text-gray-600">Available to swap</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-sm bg-green-50 border border-green-200 shrink-0" />
                <span className="text-xs text-gray-600">Can swap — click to select</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-sm bg-red-50 border border-red-200 shrink-0" />
                <span className="text-xs text-gray-600">No valid swap</span>
              </div>
            </div>
          )}

          <div>
            <button
              onClick={() => setShowMonthDropdown(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-100 hover:border-gray-400 transition-colors"
            >
              Month
              <span className="text-[10px]">{showMonthDropdown ? '▲' : '▾'}</span>
            </button>
            {showMonthDropdown && (
              <div className="mt-2 flex flex-col gap-0.5">
                {monthGroups.map(({ year, month }, idx) => (
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Single-month calendar */}
      <div className="flex-1 min-w-0">
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
            <SwapsCalendar
              year={currentMonth.year}
              month={currentMonth.month}
              shiftMap={shiftMap}
              swappableMap={swappableMap}
              partnerSwapsMap={partnerSwapsMap}
              selectedDate={selectedDate}
              Today={Today}
              onShiftClick={handleShiftClick}
              onNoSwapClick={() => setShowFatiguePopup(true)}
              onPartnerClick={setPartnerPopupDate}
              lastDate={lastShiftDate}
            />
          </>
        )}
      </div>

      {showFatiguePopup && <FatiguePopup onClose={() => setShowFatiguePopup(false)} />}

      {partnerPopupDate && (
        <SwapOptionsModal
          partnersForDate={partnerSwapsMap[partnerPopupDate] || []}
          partnerDate={partnerPopupDate}
          myDate={selectedDate}
          myShift={selectedShift}
          onClose={() => setPartnerPopupDate(null)}
          onEmailSwap={swap => { setEmailSwap(swap); setPartnerPopupDate(null) }}
        />
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
