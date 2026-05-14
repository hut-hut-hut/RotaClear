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

const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function parseDDMonYY(str) {
  // e.g. "04-Feb-26" → "2026-02-04"
  const parts = String(str).trim().split('-')
  if (parts.length !== 3) return null
  const [d, mon, y] = parts
  const month = MONTH_MAP[mon.toLowerCase()]
  if (!month) return null
  const year = 2000 + parseInt(y, 10)
  return `${year}-${month}-${d.padStart(2, '0')}`
}

function dayNameFromISO(isoDate) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[new Date(isoDate + 'T00:00:00Z').getUTCDay()]
}

// ── Format fingerprints ────────────────────────────────────────────────────

function isFormatED(rows) {
  // Track codes like "1a", "2b" appear in row 2 (index 1)
  const trackRow = rows[1] || []
  return trackRow.some(cell => cell && /^\d+[ab]$/i.test(String(cell).trim()))
}

function isFormatGenMedSHO(rows) {
  // Names always start at G5 (index [4][6]) and dates in D13 match DD-Mon-YY
  const nameCell = rows[4]?.[6]
  console.debug('[RotaClear] GenMedSHO fingerprint — G5:', nameCell, '| D13:', rows[12]?.[3])
  if (!nameCell || !String(nameCell).trim()) return false
  const dateCell = rows[12]?.[3]
  if (dateCell === null || dateCell === undefined) return false
  // Accept either an Excel serial number or a DD-Mon-YY string
  if (typeof dateCell === 'number') return true
  return /^\d{2}-[A-Za-z]{3}-\d{2}$/.test(String(dateCell).trim())
}

// ── Format parsers ─────────────────────────────────────────────────────────

function parseFormatED(rows) {
  const headerRow = rows[0] || []
  const trackRow = rows[1] || []

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
  for (const doctor of doctors) schedule[doctor] = {}

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

function parseFormatGenMedSHO(rows) {
  // Doctor names: row 5 (index 4), column G (index 6) onwards.
  // Merged cells repeat the same value across adjacent columns, so we deduplicate.
  // Names may contain Excel line breaks (\n) — normalise to a single space.
  // Stop after two consecutive empty cells (one empty cell can be a merged-cell gap).
  const nameRow = rows[4] || []
  const doctorCols = []
  const seen = new Set()
  let emptyRun = 0
  for (let i = 6; i < nameRow.length; i++) {
    const raw = nameRow[i] != null ? String(nameRow[i]) : ''
    const nameStr = raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!nameStr) {
      emptyRun++
      if (emptyRun >= 2) break
      continue
    }
    emptyRun = 0
    if (!seen.has(nameStr)) {
      seen.add(nameStr)
      doctorCols.push({ idx: i, name: nameStr })
    }
  }

  if (doctorCols.length === 0) {
    throw new Error('This rota is in a format that cannot be processed by this website.')
  }

  const doctors = doctorCols.map(d => d.name)
  const schedule = {}
  for (const doctor of doctors) schedule[doctor] = {}

  let rotaStart = null
  let rotaEnd = null

  // Data rows start at row 13 (index 12), dates in column D (index 3)
  for (let i = 12; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const rawDate = row[3]
    if (rawDate === null || rawDate === undefined) continue

    let isoDate
    if (typeof rawDate === 'number') {
      isoDate = serialToISO(rawDate)
    } else {
      isoDate = parseDDMonYY(String(rawDate))
      if (!isoDate) continue
    }

    const dayName = dayNameFromISO(isoDate)

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

// ── Main entry point ───────────────────────────────────────────────────────

export async function parseRota(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext !== 'xls' && ext !== 'xlsx') {
    throw new Error('Please upload the document in an Excel format.')
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    if (isFormatED(rows)) return parseFormatED(rows)
    if (isFormatGenMedSHO(rows)) return parseFormatGenMedSHO(rows)
  }

  throw new Error('This rota is in a format that cannot be processed by this website.')
}
