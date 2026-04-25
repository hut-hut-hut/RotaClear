import { useState, useMemo } from 'react'
import { calculateValidSwaps } from '../lib/swapRules.js'
import EmailModal from './EmailModal.jsx'

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function SwapsTab({ selectedDoctor, rotaData }) {
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [emailSwap, setEmailSwap] = useState(null)

  const swaps = useMemo(
    () => calculateValidSwaps(selectedDoctor, rotaData.schedule),
    [selectedDoctor, rotaData]
  )

  if (swaps.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-gray-700 font-medium mb-4">No swaps available</p>
        <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-600 space-y-2 mb-5">
          <p className="font-medium text-gray-700 mb-1">Fatigue rules that must be satisfied:</p>
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
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-2">
        {swaps.map((swap, i) => (
          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-gray-800">{formatDate(swap.myDate)}</span>
                <span className="text-sm text-gray-400">{swap.myShift}</span>
                <span className="text-sm text-gray-600">{swap.partnerName}</span>
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
