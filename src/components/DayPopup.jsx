function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function DayPopup({ day, onClose, onGoToRules }) {
  const { date, shiftTime, eligible, reason, isDayOff } = day

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
            <div className="w-3 h-3 rounded-full bg-pink-400 mb-3" />
            <p className="text-sm text-gray-700 leading-relaxed">
              This is a day you can request annual leave and it abides by the guidelines of the Rota Rules for the Emergency Department.
            </p>
          </div>
        )}

        {/* Variant 2: ineligible with shift */}
        {!eligible && !isDayOff && (
          <div>
            <div className="w-3 h-3 rounded-full bg-gray-300 mb-3" />
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
