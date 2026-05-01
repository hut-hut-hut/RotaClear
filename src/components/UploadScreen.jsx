import { useState, useRef } from 'react'
import { parseRota } from '../lib/parseRota.js'

export default function UploadScreen({ onRotaLoaded }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'analyzing' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  async function handleFile(file) {
    setStatus('analyzing')
    setErrorMessage('')
    try {
      const data = await parseRota(file)
      onRotaLoaded(data)
    } catch (err) {
      setStatus('error')
      setErrorMessage(err.message)
    }
  }

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">RotaClear</h1>
        <p className="text-gray-500 mb-10">
          Upload your NHS rota and instantly see which dates you can book annual leave
          and which shifts you can swap — with all trust rules applied automatically.
        </p>

        {status === 'analyzing' ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600">Thanks for the file. Analyzing…</p>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-10 transition-colors ${
              isDragging
                ? 'border-pink-400 bg-pink-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <p className="text-gray-400 text-sm mb-5">
              {isDragging ? 'Drop your file here' : 'Drag & drop your rota here, or'}
            </p>
            <button
              onClick={() => inputRef.current.click()}
              className="bg-pink-500 hover:bg-pink-600 text-white font-medium px-8 py-3 rounded-lg transition-colors cursor-pointer"
            >
              Upload your rota
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleChange}
              className="hidden"
            />
            <p className="mt-4 text-gray-400 text-sm">Accepts .xls and .xlsx files only</p>
            {status === 'error' && (
              <p className="mt-4 text-red-500 text-sm">{errorMessage}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
