import { useState } from 'react'
import LeaveTab from './LeaveTab.jsx'
import SwapsTab from './SwapsTab.jsx'
import RotaRulesTab from './RotaRulesTab.jsx'

export default function Layout({ rotaData, selectedDoctor, activeTab, onTabChange, onChangeUser, onRemoveRota }) {
  const [showConfirm, setShowConfirm] = useState(false)

  function handleConfirmRemove() {
    setShowConfirm(false)
    onRemoveRota()
  }

  const tabs = [
    { id: 'leave', label: 'Annual Leave' },
    { id: 'swaps', label: 'Swaps' },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Sticky header: disclaimer + tab bar */}
      <div className="sticky top-0 z-10 bg-white">
      <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 text-sm text-yellow-800 text-center">
        Request all annual leave and swaps through the rota coordinator, who will confirm approval. Always verify details against the official spreadsheet, as this website may contain errors.
      </div>

      {/* Tab bar + Title + Remove Rota */}
      <div className="grid grid-cols-3 items-center border-b border-gray-200 px-6">
        <h1 className="text-base font-semibold text-gray-900">RotaClear</h1>
        <div className="flex justify-center">
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
        <div className="flex justify-end items-center gap-4">
          <button
            onClick={() => onTabChange('rules')}
            className={`text-sm transition-colors ${
              activeTab === 'rules'
                ? 'text-pink-600 font-medium'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Rota Rules
          </button>
        </div>
      </div>
      <div className="px-6 py-2 border-b border-white flex items-center justify-between">
        <button
          onClick={onChangeUser}
          className="group flex items-center text-sm text-gray-600 border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-100 hover:border-gray-400 transition-colors"
        >
          <span className="inline-flex items-center overflow-hidden w-0 group-hover:w-5 transition-[width] duration-300 ease-out h-[1.2em]">
            <span className="translate-y-full group-hover:translate-y-0 transition-transform duration-700 ease-out shrink-0 pr-1.5">←</span>
          </span>
          Rota selection
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          className="group flex items-center text-sm text-gray-600 border border-gray-300 rounded-full px-3 py-1 hover:font-semibold hover:bg-red-500 hover:border-red-500 hover:text-white transition-colors"
        >
          Remove Rota
          <span className="inline-flex items-center overflow-hidden w-0 group-hover:w-6 transition-[width] duration-300 ease-out h-[1.2em]">
            <span className="translate-y-full group-hover:translate-y-0 transition-transform duration-700 ease-out shrink-0 pl-1.5 text-white font-bold text-base">×</span>
          </span>
        </button>
      </div>
      </div>{/* end sticky header */}

      {/* Active tab content */}
      <div className="flex-1 px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className={activeTab === 'leave' ? '' : 'hidden'}>
            <LeaveTab selectedDoctor={selectedDoctor} rotaData={rotaData} isActive={activeTab === 'leave'} onGoToRules={() => onTabChange('rules')} />
          </div>
          <div className={activeTab === 'swaps' ? '' : 'hidden'}>
            <SwapsTab selectedDoctor={selectedDoctor} rotaData={rotaData} isActive={activeTab === 'swaps'} />
          </div>
          <div className={activeTab === 'rules' ? '' : 'hidden'}>
            <RotaRulesTab />
          </div>
        </div>
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
