import { useState } from 'react'

function formatDateLong(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function LeaveEmailModal({ day, selectedDoctor, onClose }) {
  const [copied, setCopied] = useState(false)

  const toAddress = 'imperial.smhed-shorota@nhs.net'
  const emailBody = `Dear Rota Coordinator,\n\nI would like to request annual leave on ${formatDateLong(day.date)} (${day.shiftTime}).\n\nI understand this is within the 6-week window. Please could you let me know if this would be possible to arrange?\n\nMany thanks,\n${selectedDoctor}`
  const fullText = `To: ${toAddress}\n\n${emailBody}`

  function handleCopy() {
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-gray-800">Leave Request Email Draft</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">You can copy and paste the email to the rota coordinator</p>

        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 mb-4">
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-0.5">To</p>
            <p className="font-medium">{toAddress}</p>
          </div>
          <div className="border-t border-gray-200 pt-3 whitespace-pre-line leading-relaxed">
            {emailBody}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl transition-colors"
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  )
}
