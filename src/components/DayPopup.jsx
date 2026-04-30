import { useState } from 'react'
import LeaveEmailModal from './LeaveEmailModal.jsx'

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function ApolloAvatar() {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center shrink-0 shadow-sm">
        <span className="text-white text-lg font-bold leading-none">A</span>
      </div>
      <span className="text-xs font-semibold text-yellow-700 tracking-wide uppercase">Apollo</span>
    </div>
  )
}

export default function DayPopup({ day, selectedDoctor, isWaterCoordinator, onClose, onGoToRules }) {
  const [showEmail, setShowEmail] = useState(false)
  const { date, shiftTime, eligible, reason, isDayOff, isWithin6Weeks } = day

  if (showEmail) {
    return (
      <LeaveEmailModal
        day={day}
        selectedDoctor={selectedDoctor}
        onClose={() => setShowEmail(false)}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">{formatDate(date)}</p>
            {shiftTime && !isDayOff && (
              <p className="text-sm font-semibold text-gray-800">{shiftTime}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 text-2xl leading-none ml-4 -mt-1"
          >
            ×
          </button>
        </div>

        {/* Variant 1: eligible (pink) */}
        {eligible && (
          <div>
            <p className="text-sm text-gray-700 leading-relaxed">
              This is a day you can request annual leave.
            </p>
          </div>
        )}

        {/* Variant 4: within next 14 days (yellow) */}
        {!eligible && !isDayOff && isWithin6Weeks && (
          <div>
            {isWaterCoordinator ? (
              <>
                <ApolloAvatar />
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4">
                  <p className="text-sm text-yellow-800 leading-relaxed">
                    Your leave request is within the next two weeks.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed mb-4">
                This shift is within the next 6 weeks. You may still be able to arrange leave — contact the rota coordinator to find out.
              </p>
            )}
            <button
              onClick={() => setShowEmail(true)}
              className="w-full mt-1 px-4 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl transition-colors font-medium"
            >
              Email the rota coordinator
            </button>
          </div>
        )}

        {/* Variant 2: ineligible with shift (not within 14 days) */}
        {!eligible && !isDayOff && !isWithin6Weeks && (
          <div>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{reason}</p>
            <button
              onClick={onGoToRules}
              className="text-sm text-pink-600 hover:text-pink-700 underline"
            >
              See Rota Rules tab
            </button>
          </div>
        )}

        {/* Variant 3: day off */}
        {!eligible && isDayOff && (
          <p className="text-sm text-gray-500">No shift scheduled.</p>
        )}
      </div>
    </div>
  )
}
