import type { ChipKey, ChipUse, LeagueData, Race } from './types'
import { CHIPS } from './types'
import { fmt } from './format'

export interface Scorer {
  name: string
  points: number
  /** points above (+) or below (−) their own average at the other races; null for the first race */
  vsAvg: number | null
}

export interface Mover {
  name: string
  from: number
  to: number
}

export interface ChipGroup {
  chip: ChipKey
  uses: ChipUse[]
}

export interface Recap {
  race: Race
  best: Scorer[]
  worst: Scorer[]
  /** every player scored the same, or only a couple of players: skip the bottom list */
  topNames: string[]
  topPoints: number
  leaderAfter: string[]
  leaderBefore: string[]
  leadMargin: number | null
  leadMarginBefore: number | null
  climbers: Mover[]
  fallers: Mover[]
  average: number
  chips: ChipGroup[]
}

const sameRace = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function buildRecap(data: LeagueData, race: Race): Recap {
  const idx = data.completed.findIndex((r) => r.name === race.name)
  const prev = idx > 0 ? data.completed[idx - 1] : undefined
  const others = data.completed.filter((r) => r.name !== race.name)

  const avgOf = (name: string): number | null => {
    const g = others.map((r) => r.gains[name]).filter((x): x is number => x !== undefined)
    return g.length ? g.reduce((a, b) => a + b, 0) / g.length : null
  }

  const scorers: Scorer[] = Object.entries(race.gains)
    .map(([name, points]) => {
      const avg = avgOf(name)
      return { name, points, vsAvg: avg === null ? null : Math.round(points - avg) }
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))

  const n = scorers.length
  const take = Math.min(3, Math.floor(n / 2))
  const best = scorers.slice(0, take)
  const worst = scorers.slice(n - take).reverse()
  const topPoints = scorers[0]?.points ?? 0
  const topNames = scorers.filter((s) => s.points === topPoints).map((s) => s.name)

  const leadersOf = (r: Race | undefined) =>
    r
      ? Object.entries(r.ranks)
          .filter(([, k]) => k === 1)
          .map(([p]) => p)
      : []
  const margin = (r: Race | undefined) => {
    if (!r) return null
    const t = Object.values(r.totals).sort((a, b) => b - a)
    return t.length > 1 ? t[0] - t[1] : null
  }

  const moves = Object.entries(race.moves)
  const climbers = moves
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1] || race.ranks[a[0]] - race.ranks[b[0]])
    .slice(0, 3)
    .map(([name, m]) => ({ name, from: race.ranks[name] + m, to: race.ranks[name] }))
  const fallers = moves
    .filter(([, m]) => m < 0)
    .sort((a, b) => a[1] - b[1] || race.ranks[a[0]] - race.ranks[b[0]])
    .slice(0, 3)
    .map(([name, m]) => ({ name, from: race.ranks[name] + m, to: race.ranks[name] }))

  const raceUses = data.chipUses.filter((u) => sameRace(u.race, race.name))
  const chips: ChipGroup[] = CHIPS.map((c) => ({ chip: c.key, uses: raceUses.filter((u) => u.chip === c.key) })).filter(
    (g) => g.uses.length > 0,
  )

  return {
    race,
    best,
    worst,
    topNames,
    topPoints,
    leaderAfter: leadersOf(race),
    leaderBefore: leadersOf(prev),
    leadMargin: margin(race),
    leadMarginBefore: margin(prev),
    climbers,
    fallers,
    average: n ? Math.round(scorers.reduce((a, s) => a + s.points, 0) / n) : 0,
    chips,
  }
}

const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

/** Two plain sentences: who scored best, and what happened at the top of the table. */
export function recapSentences(r: Recap): { win: string; lead: string } {
  const joint = r.topNames.length > 1
  const win = `${list(r.topNames)} ${joint ? 'shared the top score' : 'had the top score'} with ${fmt(r.topPoints)} points${
    joint ? ' each' : ''
  }. The average was ${fmt(r.average)}.`
  const changed = r.leaderBefore.length > 0 && r.leaderAfter.join() !== r.leaderBefore.join()
  const now = r.leadMargin
  const lead =
    r.leaderAfter.length > 1
      ? `${r.leaderAfter.length === 2 ? 'They are' : 'They are all'} level at the top of the table.`
      : changed
        ? `${list(r.leaderAfter)} took the lead from ${list(r.leaderBefore)}${now !== null ? `, by ${fmt(now)} points` : ''}.`
        : r.leaderBefore.length === 0
          ? `${list(r.leaderAfter)} led after the opening race${now !== null ? ` by ${fmt(now)} points` : ''}.`
          : `${list(r.leaderAfter)} stayed in front${
              now !== null && r.leadMarginBefore !== null
                ? `, ${now === r.leadMarginBefore ? 'with the lead unchanged at' : now > r.leadMarginBefore ? 'extending the lead to' : 'with the lead down to'} ${fmt(now)} points`
                : ''
            }.`
  return { win, lead }
}
