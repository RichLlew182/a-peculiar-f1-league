import { driverName } from './names'
import type { ChipKey, Highlight, LeagueData } from './types'

const fmt = (n: number) => n.toLocaleString('en-GB')
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n))

export interface PlayerStats {
  name: string
  raceWins: number
  racesLed: number
  bestRace: { points: number; race: string } | null
  worstRace: { points: number; race: string } | null
  avgPerRace: number
  chipsUsed: number
}

export function playerStats(data: LeagueData): PlayerStats[] {
  return data.players.map((p) => {
    let raceWins = 0
    let racesLed = 0
    let best: PlayerStats['bestRace'] = null
    let worst: PlayerStats['worstRace'] = null
    let sum = 0
    let n = 0
    for (const r of data.completed) {
      const g = r.gains[p.name]
      if (g === undefined) continue
      sum += g
      n++
      if (!best || g > best.points) best = { points: g, race: r.name }
      if (!worst || g < worst.points) worst = { points: g, race: r.name }
      const top = Math.max(...Object.values(r.gains))
      if (g === top) raceWins++
      if (r.ranks[p.name] === 1) racesLed++
    }
    return {
      name: p.name,
      raceWins,
      racesLed,
      bestRace: best,
      worstRace: worst,
      avgPerRace: n ? sum / n : 0,
      chipsUsed: Object.values(p.chips).filter(Boolean).length,
    }
  })
}

/** Most-picked drivers and constructors across the league's current teams. */
export function ownership(data: LeagueData) {
  const count = (codes: string[]) => {
    const m = new Map<string, number>()
    for (const c of codes) m.set(c, (m.get(c) ?? 0) + 1)
    return [...m.entries()].map(([code, owners]) => ({ code, owners })).sort((a, b) => b.owners - a.owners)
  }
  return {
    drivers: count(data.players.flatMap((p) => p.drivers.map((d) => d.code))),
    constructors: count(data.players.flatMap((p) => p.constructors.map((c) => c.code))),
  }
}

export function highlights(data: LeagueData): Highlight[] {
  const out: Highlight[] = []
  const done = data.completed
  if (done.length === 0) return out
  const stats = playerStats(data)

  // Best single race score
  let bestScore = { player: '', race: '', points: -Infinity }
  let worstScore = { player: '', race: '', points: Infinity }
  for (const r of done) {
    for (const [player, g] of Object.entries(r.gains)) {
      if (g > bestScore.points) bestScore = { player, race: r.name, points: g }
      if (g < worstScore.points) worstScore = { player, race: r.name, points: g }
    }
  }
  out.push({
    id: 'best-race',
    label: 'Best single race',
    value: `${fmt(bestScore.points)} pts`,
    detail: `${bestScore.player} at ${bestScore.race}`,
    players: [bestScore.player],
  })

  // Most race wins
  const wins = [...stats].sort((a, b) => b.raceWins - a.raceWins)
  if (wins[0] && wins[0].raceWins > 0) {
    const tied = wins.filter((s) => s.raceWins === wins[0].raceWins)
    out.push({
      id: 'race-wins',
      label: 'Most race wins (joint included)',
      value: `${wins[0].raceWins} of ${done.length}`,
      detail: tied.map((s) => s.name).join(', '),
      players: tied.map((s) => s.name),
    })
  }

  // Most weeks leading
  const led = [...stats].sort((a, b) => b.racesLed - a.racesLed)
  if (led[0] && led[0].racesLed > 0) {
    const tied = led.filter((s) => s.racesLed === led[0].racesLed)
    out.push({
      id: 'races-led',
      label: 'Most weeks in the lead',
      value: `${led[0].racesLed} races`,
      detail: tied.map((s) => s.name).join(', '),
      players: tied.map((s) => s.name),
    })
  }

  // Best average
  const avg = [...stats].sort((a, b) => b.avgPerRace - a.avgPerRace)[0]
  out.push({
    id: 'avg',
    label: 'Best average per race',
    value: `${Math.round(avg.avgPerRace)} pts`,
    detail: avg.name,
    players: [avg.name],
  })

  // Biggest climb in one race
  let climb = { player: '', race: '', places: 0, from: 0, to: 0 }
  for (const r of done) {
    for (const [player, move] of Object.entries(r.moves)) {
      if (move > climb.places) {
        climb = { player, race: r.name, places: move, from: r.ranks[player] + move, to: r.ranks[player] }
      }
    }
  }
  if (climb.places > 0) {
    out.push({
      id: 'climb',
      label: 'Biggest climb in one race',
      value: `${climb.places} places`,
      detail: `${climb.player} at ${climb.race} (${ord(climb.from)} to ${ord(climb.to)})`,
      players: [climb.player],
    })
  }

  // Most improved: position after the first race versus now
  if (done.length > 1) {
    const first = done[0]
    const last = done[done.length - 1]
    const moves = data.playerNames
      .filter((nm) => first.ranks[nm] !== undefined && last.ranks[nm] !== undefined)
      .map((nm) => ({ name: nm, from: first.ranks[nm], to: last.ranks[nm], places: first.ranks[nm] - last.ranks[nm] }))
      .sort((a, b) => b.places - a.places)
    if (moves.length > 0 && moves[0].places > 0) {
      const tied = moves.filter((m) => m.places === moves[0].places)
      out.push({
        id: 'most-improved',
        label: 'Most improved this season',
        value: `${moves[0].places} places`,
        detail: tied
          .map((m) => `${m.name}: ${ord(m.from)} after ${first.name} to ${ord(m.to)} now`)
          .join('; '),
        players: tied.map((m) => m.name),
      })
    }
  }

  // Biggest lead over second place
  let lead = { race: '', by: -Infinity, player: '' }
  for (const r of done) {
    const sorted = Object.entries(r.totals).sort((a, b) => b[1] - a[1])
    if (sorted.length > 1) {
      const by = sorted[0][1] - sorted[1][1]
      if (by > lead.by) lead = { race: r.name, by, player: sorted[0][0] }
    }
  }
  if (lead.by > -Infinity) {
    out.push({
      id: 'biggest-lead',
      label: 'Biggest lead at the top',
      value: `${fmt(lead.by)} pts`,
      detail: `${lead.player} after ${lead.race}`,
      players: [lead.player],
    })
  }

  // Sprint specialist: best total across sprint weekends
  const sprints = done.filter((r) => r.sprint)
  if (sprints.length > 0) {
    const totals = data.playerNames.map((name) => ({
      name,
      pts: sprints.reduce((s, r) => s + (r.gains[name] ?? 0), 0),
    }))
    totals.sort((a, b) => b.pts - a.pts)
    out.push({
      id: 'sprint',
      label: 'Sprint weekend specialist',
      value: `${fmt(totals[0].pts)} pts`,
      detail: `${totals[0].name} across ${sprints.length} sprint weekends`,
      players: [totals[0].name],
    })
  }

  // Lowest score
  out.push({
    id: 'worst-race',
    label: 'Toughest weekend',
    value: `${fmt(worstScore.points)} pts`,
    detail: `${worstScore.player} at ${worstScore.race}`,
    players: [worstScore.player],
  })

  return out
}

export function ord(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export { signed, fmt }


const sameRace = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const sgn = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : '0')
const joinNames = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

/** Facts about how chips were used, from the Chip Usage tab. Empty if there is no chip data. */
export function chipHighlights(data: LeagueData): Highlight[] {
  const out: Highlight[] = []
  if (data.chipUses.length === 0) return out

  const names: Record<ChipKey, string> = {
    LL: 'Limitless',
    WC: 'Wildcard',
    FF: 'Final Fix',
    AP: 'Autopilot',
    NN: 'No Negative',
    '3X': 'Extra DRS',
  }

  // How far a chip race score was ahead of (or behind) the best score by anyone else that weekend.
  const impact = (chip: ChipKey) =>
    data.chipUses
      .filter((u) => u.chip === chip)
      .flatMap((u) => {
        const race = data.completed.find((r) => sameRace(r.name, u.race))
        const points = race?.gains[u.player]
        if (!race || points === undefined) return []
        const rivals = Object.entries(race.gains).filter(([name]) => name !== u.player)
        if (rivals.length === 0) return []
        const [, rivalPoints] = rivals.reduce((a, c) => (c[1] > a[1] ? c : a))
        const tied = rivals.filter(([, g]) => g === rivalPoints).map(([n]) => n)
        return [{ player: u.player, race: race.name, points, rival: tied, rivalPoints, margin: points - rivalPoints }]
      })

  const describe = (u: ReturnType<typeof impact>[number]) =>
    u.margin >= 0
      ? `${u.player} at ${u.race}: ${fmt(u.points)} pts, ${fmt(u.margin)} clear of the next best (${joinNames(u.rival)}, ${fmt(u.rivalPoints)})`
      : `${u.player} at ${u.race}: ${fmt(u.points)} pts, ${fmt(Math.abs(u.margin))} behind the best score (${joinNames(u.rival)}, ${fmt(u.rivalPoints)})`

  for (const chip of ['LL', '3X'] as const) {
    const uses = impact(chip)
    if (uses.length === 0) continue
    const best = Math.max(...uses.map((u) => u.margin))
    const topUses = uses.filter((u) => u.margin === best)
    out.push({
      id: `best-${chip}`,
      label: `Best use of ${names[chip]}`,
      value: `${sgn(best)} pts`,
      detail: topUses.map(describe).join('; '),
      players: topUses.map((u) => u.player),
    })
    if (uses.length > 1) {
      const worst = Math.min(...uses.map((u) => u.margin))
      const lowUses = uses.filter((u) => u.margin === worst)
      out.push({
        id: `worst-${chip}`,
        label: `Worst use of ${names[chip]}`,
        value: `${sgn(worst)} pts`,
        detail: lowUses.map(describe).join('; '),
        players: lowUses.map((u) => u.player),
      })
    }
  }

  // Most popular race for a chip
  for (const chip of ['LL', '3X', 'NN'] as const) {
    const counts = new Map<string, string[]>()
    for (const u of data.chipUses.filter((x) => x.chip === chip)) {
      counts.set(u.race, [...(counts.get(u.race) ?? []), u.player])
    }
    if (counts.size === 0) continue
    const top = Math.max(...[...counts.values()].map((v) => v.length))
    const races = [...counts.entries()].filter(([, v]) => v.length === top)
    out.push({
      id: `popular-${chip}`,
      label: `Most popular ${names[chip]} race`,
      value: joinNames(races.map(([r]) => r)),
      detail: `${top} ${top === 1 ? 'player' : 'players'}${races.length > 1 ? ' each' : ''}`,
      players: races.flatMap(([, v]) => v),
    })
  }

  // Most common driver brought in with Final Fix
  const swaps = new Map<string, string[]>()
  for (const u of data.chipUses.filter((x) => x.chip === 'FF' && x.in)) {
    swaps.set(u.in as string, [...(swaps.get(u.in as string) ?? []), u.player])
  }
  if (swaps.size > 0) {
    const top = Math.max(...[...swaps.values()].map((v) => v.length))
    const picked = [...swaps.entries()].filter(([, v]) => v.length === top)
    out.push({
      id: 'ff-in',
      label: 'Favourite Final Fix signing',
      value: joinNames(picked.map(([code]) => driverName(code))),
      detail: `Brought in ${top} ${top === 1 ? 'time' : 'times'}${picked.length > 1 ? ' each' : ''}`,
      players: picked.flatMap(([, v]) => v),
    })
  }

  return out
}
