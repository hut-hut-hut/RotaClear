import { useState, useEffect } from 'react'
import UploadScreen from './components/UploadScreen.jsx'

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

  function handleRemoveRota() {
    setRotaData(null)
    setSelectedDoctor(null)
    setActiveTab('leave')
    setScreen('upload')
  }

  if (screen === 'upload') {
    return <UploadScreen onRotaLoaded={handleRotaLoaded} />
  }

  return null
}

export default App
