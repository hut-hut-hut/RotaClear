import { useState } from 'react'

export default function SetupScreen({ rotaData, onSetup }) {
  const [query, setQuery] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [mode, setMode] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const doctors = rotaData.doctors

  const filtered = query.trim() === ''
    ? doctors
    : doctors.filter(d => d.toLowerCase().includes(query.toLowerCase()))

  const noMatch = query.trim().length > 0 && filtered.length === 0
  const canGo = selectedDoctor !== null && mode !== null

  function handleQueryChange(e) {
    setQuery(e.target.value)
    setSelectedDoctor(null)
    setDropdownOpen(true)
  }

  function handleSelect(doctor) {
    setSelectedDoctor(doctor)
    setQuery(doctor)
    setDropdownOpen(false)
  }

  function handleBlur() {
    setTimeout(() => setDropdownOpen(false), 150)
  }

  function handleChevronMouseDown(e) {
    e.preventDefault() // keep input focused
    setDropdownOpen(o => !o)
  }

  function handleGo() {
    if (!canGo) return
    onSetup(selectedDoctor, mode)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-semibold text-gray-900 mb-8 text-center">RotaClear</h1>

        <div className="grid grid-cols-2 gap-10">
          {/* Left column: controls */}
          <div className="flex flex-col gap-5">
            {/* Searchable name dropdown */}
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={handleQueryChange}
                onFocus={() => setDropdownOpen(true)}
                onBlur={handleBlur}
                placeholder="Select your name…"
                className="w-full border border-gray-300 rounded-lg pl-4 pr-10 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
              {/* Chevron toggle */}
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={handleChevronMouseDown}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-md mt-1 z-10 max-h-52 overflow-y-auto">
                  {noMatch ? (
                    <div className="px-4 py-2 text-gray-400 text-sm">Name not available</div>
                  ) : (
                    filtered.map(doctor => (
                      <button
                        key={doctor}
                        onMouseDown={() => handleSelect(doctor)}
                        className="block w-full text-left px-4 py-2 hover:bg-pink-50 text-gray-800 text-sm"
                      >
                        {doctor}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Leave / Swap toggle */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setMode('leave')}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  mode === 'leave'
                    ? 'bg-pink-500 text-white border-pink-500'
                    : 'border-gray-300 text-gray-700 hover:border-pink-300'
                }`}
              >
                Annual Leave
              </button>
              <button
                onClick={() => setMode('swaps')}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  mode === 'swaps'
                    ? 'bg-pink-500 text-white border-pink-500'
                    : 'border-gray-300 text-gray-700 hover:border-pink-300'
                }`}
              >
                Swap
              </button>
            </div>

            {/* Go button */}
            <button
              onClick={handleGo}
              disabled={!canGo}
              className={`px-8 py-3 rounded-lg font-semibold transition-colors ${
                canGo
                  ? 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              Go
            </button>
          </div>

          {/* Right column: instructions */}
          <div className="flex flex-col gap-6 text-gray-600 justify-center">
            <div>
              <p className="font-semibold text-gray-800 mb-1">Step 1</p>
              <p className="text-sm">Click the dropdown to scroll through names, or type to search for yours</p>
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-1">Step 2</p>
              <p className="text-sm">Once you've selected your name, choose if you want to do a swap or leave</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
