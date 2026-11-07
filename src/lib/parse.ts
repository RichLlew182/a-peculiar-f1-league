import { isBlankRow, parseCsv, parseMoney, parseNum } from './csv'
import { CHIPS, type ChipKey, type ChipUse, type Colours, type LeagueData, type Pick, type Player, type Race } from './types'

/** Budget (in £m) every player starts a season with. */
const START_BUDGET = 100

function colIndex(header: string[], label: string): number {
  return header.findIndex((h) => h.trim().toLowerCase() === label.toLowerCase())
}

function readPicks(row: string[], start: number, count: number): Pick[] {
  const picks: Pick[] = []
  for (let i = 0; i < count; i++) {
    const code = (row[start + i * 2] ?? '').trim()
    if (!code) continue
    picks.push({ code, price: parseMoney(row[start + i * 2 + 1]) })
  }
  return picks
}

/** Sheet 1: one row per player with chips, team and budget. */
export function parseLeaderboard(csv: string): Player[] {
  const rows = parseCsv(csv)
  const header = rows[0] ?? []
  const iName = colIndex(header, 'Player')
  const iPoints = colIndex(header, 'Points')
  const iTeam = header.findIndex((h) => h.trim().toLowerCase().startsWith('team 1'))
  const iValue = colIndex(header, 'Value')
  const iCap = colIndex(header, 'Cap')
  const iBudget = colIndex(header, 'Budget')
  const iTeamName = colIndex(header, 'Team Name')
  if (iName < 0 || iPoints < 0 || iTeam < 0) {
    throw new Error('Leaderboard sheet is missing expected columns (Player, Points, Team 1)')
  }

  const players: Player[] = []
  for (const row of rows.slice(1)) {
    if (isBlankRow(row)) continue
    const name = (row[iName] ?? '').trim()
    const points = parseNum(row[iPoints])
    if (!name || Number.isNaN(points)) continue

    const chips = {} as Record<ChipKey, boolean>
    for (const chip of CHIPS) {
      const i = colIndex(header, chip.key)
      chips[chip.key] = i >= 0 && (row[i] ?? '').trim().toUpperCase() === 'TRUE'
    }

    const drivers = readPicks(row, iTeam + 4, 5)
    if (drivers[0]) drivers[0].boosted = true

    players.push({
      name,
      teamName: iTeamName >= 0 ? (row[iTeamName] ?? '').trim() : '',
      rank: 0,
      points,
      gap: 0,
      leaderGap: 0,
      chips,
      constructors: readPicks(row, iTeam, 2),
      drivers,
      value: parseMoney(row[iValue]),
      cap: parseMoney(row[iCap]),
      budget: parseMoney(row[iBudget]),
    })
  }

  // Derive rank and gaps from points so they can never disagree with the totals.
  players.sort((a, b) => b.points - a.points)
  const lead = players[0]?.points ?? 0
  players.forEach((p, i) => {
    p.rank = i > 0 && p.points === players[i - 1].points ? players[i - 1].rank : i + 1
    p.leaderGap = p.points - lead
    p.gap = i === 0 ? 0 : p.points - players[i - 1].points
  })
  return players
}

/**
 * The history sheet can label a player slightly differently from the leaderboard
 * (e.g. "Richard" vs "Richard L"). Match exact names first, then pair up the one
 * unmatched name on each side.
 */
function buildNameMap(historyNames: string[], leaderboardNames: string[]): Map<string, string> {
  const map = new Map<string, string>()
  const usedLb = new Set<string>()
  for (const h of historyNames) {
    if (leaderboardNames.includes(h)) {
      map.set(h, h)
      usedLb.add(h)
    }
  }
  const restH = historyNames.filter((h) => !map.has(h))
  const restL = leaderboardNames.filter((l) => !usedLb.has(l))
  if (restH.length === 1 && restL.length === 1) {
    map.set(restH[0], restL[0])
  } else {
    for (const h of restH) {
      const hit = restL.find((l) => l.startsWith(h) || h.startsWith(l))
      if (hit) map.set(h, hit)
    }
  }
  for (const h of restH) if (!map.has(h)) map.set(h, h)
  return map
}

/** Sheet 2: one row per race, a cumulative total and race score per player. */
export function parseHistory(csv: string, leaderboardNames: string[]): Race[] {
  const rows = parseCsv(csv)
  const header = rows[0] ?? []
  const iRaces = colIndex(header, 'Races')
  if (iRaces < 0) throw new Error('History sheet is missing the "Races" column')

  // Player columns: a name followed by its gain column, until the first blank name.
  const cols: { name: string; total: number; gain: number }[] = []
  for (let i = iRaces + 1; i < header.length; i += 2) {
    const n = (header[i] ?? '').trim()
    if (!n) break
    cols.push({ name: n, total: i, gain: i + 1 })
  }
  const nameMap = buildNameMap(
    cols.map((c) => c.name),
    leaderboardNames,
  )

  const races: Race[] = []
  for (const row of rows.slice(1)) {
    if (isBlankRow(row)) continue
    const rawName = (row[iRaces] ?? '').trim()
    if (!rawName) continue

    const sprint = /\(sp\)\s*$/i.test(rawName)
    const name = rawName.replace(/\s*\(sp\)\s*$/i, '')
    const totals: Record<string, number> = {}
    const gains: Record<string, number> = {}
    for (const c of cols) {
      const player = nameMap.get(c.name) ?? c.name
      const t = parseNum(row[c.total])
      if (!Number.isNaN(t)) totals[player] = t
      const g = parseNum(row[c.gain])
      if (!Number.isNaN(g)) gains[player] = g
    }
    // A race counts once someone has points (a sheet that pre-fills zeros is still "not raced yet")
    const complete = Object.values(totals).some((t) => t > 0)
    races.push({
      name,
      sprint,
      round: races.length + 1,
      complete,
      totals,
      gains,
      ranks: {},
      moves: {},
    })
  }

  // Ranks (1 = leader, ties share a rank) and movement, derived from the totals.
  let prev: Record<string, number> | null = null
  for (const race of races) {
    if (!race.complete) continue
    const ordered = Object.entries(race.totals).sort((a, b) => b[1] - a[1])
    ordered.forEach(([player, total], i) => {
      race.ranks[player] = i > 0 && total === ordered[i - 1][1] ? race.ranks[ordered[i - 1][0]] : i + 1
    })
    for (const player of Object.keys(race.ranks)) {
      race.moves[player] = prev && prev[player] !== undefined ? prev[player] - race.ranks[player] : 0
    }
    prev = race.ranks
  }
  return races
}

const HEX = /^#[0-9a-f]{6}$/i

/**
 * Colours tab: blocks headed "Teams", "Drivers" and "Chips", each a code column
 * followed by a hex column. A "Chips Unused" block may follow; it is ignored,
 * because unused chips are drawn as an outline of the chip's own colour.
 */
export function parseColours(csv: string): Colours {
  const out: Colours = { teams: {}, drivers: {}, chips: {} }
  const rows = parseCsv(csv)
  const headerRow = rows.find((r) => r.some((c) => c.trim() === 'Teams'))
  if (!headerRow) return out
  const col = (label: string) => headerRow.findIndex((c) => c.trim() === label)
  const blocks: [number, (code: string, hex: string) => void][] = [
    [col('Teams'), (c, h) => void (out.teams[c] = h)],
    [col('Drivers'), (c, h) => void (out.drivers[c] = h)],
    [col('Chips'), (c, h) => void (CHIPS.some((x) => x.key === c) && (out.chips[c as ChipKey] = h))],
  ]
  for (const row of rows.slice(rows.indexOf(headerRow) + 1)) {
    for (const [i, set] of blocks) {
      if (i < 0) continue
      const code = (row[i] ?? '').trim().toUpperCase()
      const hex = (row[i + 1] ?? '').trim()
      if (code && HEX.test(hex)) set(code, hex)
    }
  }
  return out
}

/** Chip Usage tab: per player, each chip's TRUE/FALSE flag followed by the race it was played at. */
export function parseChipUsage(csv: string, leaderboardNames: string[]): ChipUse[] {
  const rows = parseCsv(csv)
  const header = rows[0] ?? []
  const iChange = colIndex(header, 'Change')
  const iOut = colIndex(header, 'Replaced Driver Extra Pts')
  const iIn = colIndex(header, 'Replacement Driver Extra Pts')
  const num = (v: string | undefined) => {
    const t = (v ?? '').trim().replace(/,/g, '')
    return t !== '' && Number.isFinite(Number(t)) ? Number(t) : undefined
  }
  const cols = CHIPS.map((c) => ({ key: c.key, i: colIndex(header, c.key) })).filter((c) => c.i >= 0)
  const nameMap = buildNameMap(
    rows.slice(1).map((r) => (r[0] ?? '').trim()).filter(Boolean),
    leaderboardNames,
  )
  const uses: ChipUse[] = []
  for (const row of rows.slice(1)) {
    const raw = (row[0] ?? '').trim()
    if (!raw) continue
    const player = nameMap.get(raw) ?? raw
    for (const { key, i } of cols) {
      if ((row[i] ?? '').trim().toUpperCase() !== 'TRUE') continue
      const race = (row[i + 1] ?? '').trim()
      if (!race) continue
      const use: ChipUse = { player, chip: key, race }
      if (key === 'FF' && iChange >= 0) {
        const [out, inn] = (row[iChange] ?? '').split('>').map((x) => x.trim().toUpperCase())
        if (out && inn) {
          use.out = out
          use.in = inn
        }
        if (iOut >= 0 && iIn >= 0) {
          use.outPoints = num(row[iOut])
          use.inPoints = num(row[iIn])
        }
      }
      uses.push(use)
    }
  }
  return uses
}

export function parseLeague(leaderboardCsv: string, historyCsv: string, coloursCsv = '', chipsCsv = ''): LeagueData {
  const players = parseLeaderboard(leaderboardCsv)
  const playerNames = players.map((p) => p.name)
  const races = parseHistory(historyCsv, playerNames)
  const colours = coloursCsv ? parseColours(coloursCsv) : { teams: {}, drivers: {}, chips: {} }
  let chipUses: ChipUse[] = []
  try {
    chipUses = chipsCsv ? parseChipUsage(chipsCsv, playerNames) : []
  } catch {
    /* the chip tab is optional */
  }
  const completed = races.filter((r) => r.complete)
  // Before the first race the sheet may have no budget yet: everyone starts on £100m
  if (completed.length === 0) for (const p of players) if (!(p.budget > 0)) p.budget = START_BUDGET
  return { players, colours, races, completed, playerNames, chipUses }
}
