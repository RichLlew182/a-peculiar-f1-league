/** Minimal RFC-4180 CSV parser (handles quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** "£28.8m" -> 28.8 ; blank/invalid -> NaN */
export function parseMoney(s: string | undefined): number {
  if (!s) return NaN
  const n = parseFloat(s.replace(/[£$m,\s]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/** "+259", "-29", "--5", "4,825" -> number; blank/invalid -> NaN */
export function parseNum(s: string | undefined): number {
  if (s === undefined) return NaN
  const t = s.trim().replace(/,/g, '')
  if (t === '') return NaN
  const n = Number(t.replace(/^\+/, '').replace(/^--/, ''))
  return Number.isFinite(n) ? n : NaN
}

export function isBlankRow(row: string[]): boolean {
  return row.every((c) => c.trim() === '')
}
