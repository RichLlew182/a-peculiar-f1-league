import { isBlankRow, parseCsv, parseMoney, parseNum } from './csv'
import { CHIPS, type ChipKey, type LeagueData, type Pick, type Player, type Race } from './types'

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
    const complete = Object.keys(totals).length > 0
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

export function parseLeague(leaderboardCsv: string, historyCsv: string): LeagueData {
  const players = parseLeaderboard(leaderboardCsv)
  const playerNames = players.map((p) => p.name)
  const races = parseHistory(historyCsv, playerNames)
  return { players, races, completed: races.filter((r) => r.complete), playerNames }
}
