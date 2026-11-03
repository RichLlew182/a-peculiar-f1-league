const CODES: Record<string, string> = {
  Australia: 'AUS',
  China: 'CHN',
  Japan: 'JPN',
  Miami: 'MIA',
  Canada: 'CAN',
  Monaco: 'MON',
  Barcelona: 'BAR',
  Austria: 'AUT',
  'Great Britain': 'GBR',
  Belgium: 'BEL',
  Hungary: 'HUN',
  Netherlands: 'NED',
  Italy: 'ITA',
  Spain: 'ESP',
  Azerbaijan: 'AZE',
  Malaysia: 'MYS',
  Singapore: 'SGP',
  'United States': 'USA',
  Mexico: 'MEX',
  Brazil: 'BRA',
  'Las Vegas': 'LVG',
  Qatar: 'QAT',
  'Abu Dhabi': 'ABU',
}

/** Three-letter race label for tight axes. Unknown races fall back to their first three letters. */
export function raceCode(name: string): string {
  return CODES[name] ?? name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
}

export const fmt = (n: number) => n.toLocaleString('en-GB')

/** Signed with a real minus sign: +29, −29, 0 */
export const signedFmt = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : '0')

export const money = (n: number) => (Number.isFinite(n) ? `£${n.toFixed(1)}m` : '–')

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function ago(d: Date, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  return `${Math.round(h / 24)} days ago`
}
