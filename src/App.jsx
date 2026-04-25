import { useState, useEffect } from 'react'
import UploadScreen from './components/UploadScreen.jsx'
import SetupScreen from './components/SetupScreen.jsx'

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
    setScreen('main')
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

  return null
}

export default App
