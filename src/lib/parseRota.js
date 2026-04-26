import * as XLSX from '@e965/xlsx'

function serialToISO(serial) {
  // Excel epoch is Dec 30, 1899 (accounts for Excel's 1900 leap year bug)
  const excelEpoch = new Date(Date.UTC(1899, 11, 30))
  const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function parseRota(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext !== 'xls' && ext !== 'xlsx') {
    throw new Error('Please upload the document in an Excel format.')
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  const headerRow = rows[0] || []
  const trackRow = rows[1] || []

  // Use track numbers (e.g. "1a", "2b") to identify valid doctor columns.
  // This filters out EMPTY slots, Locum, Gap, and staffing-total columns.
  const doctorCols = []
  for (let i = 3; i < trackRow.length; i++) {
    const track = trackRow[i]
    if (track && /^\d+[ab]$/i.test(String(track).trim())) {
      const name = headerRow[i]
      const nameStr = name ? String(name).trim() : ''
      if (nameStr && nameStr.toUpperCase() !== 'EMPTY') {
        doctorCols.push({ idx: i, name: nameStr })
      }
    }
  }

  if (doctorCols.length === 0) {
    throw new Error('This rota is in a format that cannot be processed by this website.')
  }

  const doctors = doctorCols.map(d => d.name)
  const schedule = {}
  for (const doctor of doctors) {
    schedule[doctor] = {}
  }

  let rotaStart = null
  let rotaEnd = null

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const rawDate = row[1]
    if (rawDate === null || rawDate === undefined) continue

    let isoDate
    if (typeof rawDate === 'number') {
      isoDate = serialToISO(rawDate)
    } else {
      const parts = String(rawDate).trim().split('/')
      if (parts.length !== 3) continue
      const [d, m, y] = parts
      isoDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    const dayName = row[2] ? String(row[2]).trim() : ''

    if (!rotaStart || isoDate < rotaStart) rotaStart = isoDate
    if (!rotaEnd || isoDate > rotaEnd) rotaEnd = isoDate

    doctorCols.forEach(({ idx, name }) => {
      const cellValue = row[idx]
      const shift = cellValue !== undefined && cellValue !== null ? String(cellValue).trim() : ''
      schedule[name][isoDate] = { shift, day: dayName }
    })
  }

  if (!rotaStart) {
    throw new Error('This rota is in a format that cannot be processed by this website.')
  }

  return { doctors, schedule, rotaStart, rotaEnd }
}
