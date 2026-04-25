import { useState } from 'react'
import LeaveTab from './LeaveTab.jsx'
import SwapsTab from './SwapsTab.jsx'
import RotaRulesTab from './RotaRulesTab.jsx'

export default function Layout({ rotaData, selectedDoctor, activeTab, onTabChange, onRemoveRota }) {
  const [showConfirm, setShowConfirm] = useState(false)

  function handleConfirmRemove() {
    setShowConfirm(false)
    onRemoveRota()
  }

  const tabs = [
    { id: 'leave', label: 'Leave' },
    { id: 'swaps', label: 'Swaps' },
    { id: 'rules', label: 'Rota Rules' },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Disclaimer */}
      <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 text-sm text-yellow-800 text-center">
        Please double-check everything with your rota coordinator and the actual spreadsheet as this website can make mistakes.
      </div>

      {/* Tab bar + Remove Rota */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6">
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-pink-500 text-pink-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          className="text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          Remove Rota
        </button>
      </div>

      {/* Active tab content */}
      <div className="flex-1 px-6 py-6">
        {activeTab === 'leave' && <LeaveTab selectedDoctor={selectedDoctor} rotaData={rotaData} />}
        {activeTab === 'swaps' && <SwapsTab selectedDoctor={selectedDoctor} rotaData={rotaData} />}
        {activeTab === 'rules' && <RotaRulesTab />}
      </div>

      {/* Remove Rota confirmation modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-gray-800 mb-6 text-sm leading-relaxed">
              This button will remove your rota and return you to the home page where you will have the option to upload a new rota.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
