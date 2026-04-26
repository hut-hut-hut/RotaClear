import { useState, useEffect } from 'react'
import UploadScreen from './components/UploadScreen.jsx'
import SetupScreen from './components/SetupScreen.jsx'
import Layout from './components/Layout.jsx'

function App() {
  const [screen, setScreen] = useState('upload')
  const [rotaData, setRotaData] = useState(null)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [activeTab, setActiveTab] = useState('leave')

  useEffect(() => {
    if (!rotaData) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [rotaData])

  function handleRotaLoaded(data) {
    setRotaData(data)
    setScreen('setup')
  }

  function handleSetup(doctor, mode) {
    setSelectedDoctor(doctor)
    setActiveTab(mode)
    setScreen('loading')
    // Double-RAF ensures the loading screen paints before the heavy computation runs
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setScreen('main')
      })
    })
  }

  function handleRemoveRota() {
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
    <Layout
      rotaData={rotaData}
      selectedDoctor={selectedDoctor}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRemoveRota={handleRemoveRota}
    />
  )
}

export default App
