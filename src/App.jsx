import { useState, useEffect } from 'react'
import { Retune } from 'retune'
import UploadScreen from './components/UploadScreen.jsx'
import SetupScreen from './components/SetupScreen.jsx'
import Layout from './components/Layout.jsx'

const SESSION_KEY = 'rotaclear_session'

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function App() {
  const saved = loadSession()

  const [screen, setScreen] = useState(() => {
    if (!saved) return 'upload'
    // 'loading' is transient — never restore to it
    return saved.screen === 'loading' ? 'main' : saved.screen
  })
  const [rotaData, setRotaData] = useState(saved?.rotaData || null)
  const [selectedDoctor, setSelectedDoctor] = useState(saved?.selectedDoctor || null)
  const [activeTab, setActiveTab] = useState(saved?.activeTab || 'leave')

  // Persist session whenever state changes
  useEffect(() => {
    if (rotaData) {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ screen, rotaData, selectedDoctor, activeTab }))
      } catch {
        // sessionStorage unavailable or full — silently ignore
      }
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [screen, rotaData, selectedDoctor, activeTab])

  function handleRotaLoaded(data) {
    setRotaData(data)
    setScreen('setup')
  }

  function handleSetup(doctor, mode) {
    setSelectedDoctor(doctor)
    setActiveTab(mode)
    setScreen('loading')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setScreen('main')
      })
    })
  }

  function handleChangeUser() {
    setScreen('setup')
  }

  function handleRemoveRota() {
    sessionStorage.removeItem(SESSION_KEY)
    setRotaData(null)
    setSelectedDoctor(null)
    setActiveTab('leave')
    setScreen('upload')
  }

  if (screen === 'upload') {
    return <UploadScreen onRotaLoaded={handleRotaLoaded} />
  }

  if (screen === 'setup') {
    return <SetupScreen rotaData={rotaData} onSetup={handleSetup} />
  }

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading your rota…</p>
      </div>
    )
  }

  return (
    <>
      <Retune />
      <Layout
        rotaData={rotaData}
        selectedDoctor={selectedDoctor}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onChangeUser={handleChangeUser}
        onRemoveRota={handleRemoveRota}
      />
    </>
  )
}

export default App
