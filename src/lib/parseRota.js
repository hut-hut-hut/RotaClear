import * as XLSX from '@e965/xlsx'

export async function parseRota(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext !== 'xls' && ext !== 'xlsx') {
    throw new Error('Please upload the document in an Excel format.')
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  // Row 0: column headers — doctor names start at index 3
  const headerRow = rows[0] || []
  const doctors = headerRow.slice(3).filter(name => name && String(name).trim() !== '')

  if (doctors.length === 0) {
    throw new Error('This rota is in a format that cannot be processed by this website.')
  }

  // Row 1 (index 1): track numbers — skip
  // Rows 2+ (index 2+): data rows
  const schedule = {}
  for (const doctor of doctors) {
    schedule[String(doctor)] = {}
  }

  let rotaStart = null
  let rotaEnd = null

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[1]) continue

    const rawDate = String(row[1]).trim()
    const parts = rawDate.split('/')
    if (parts.length !== 3) continue

    const [day, month, year] = parts
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const dayName = row[2] ? String(row[2]).trim() : ''

    if (!rotaStart || isoDate < rotaStart) rotaStart = isoDate
    if (!rotaEnd || isoDate > rotaEnd) rotaEnd = isoDate

    doctors.forEach((doctor, idx) => {
      const cellValue = row[idx + 3]
      const shift = cellValue !== undefined && cellValue !== null ? String(cellValue).trim() : ''
      schedule[String(doctor)][isoDate] = { shift, day: dayName }
    })
  }

  if (!rotaStart) {
    throw new Error('This rota is in a format that cannot be processed by this website.')
  }

  return { doctors: doctors.map(String), schedule, rotaStart, rotaEnd }
}
