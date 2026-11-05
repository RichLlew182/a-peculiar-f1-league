import type { ChipKey, ChipUse, LeagueData, Player } from './types'

export interface RaceLine {
  race: string
  sprint: boolean
  round: number
  points: number
  total: number
  rank: number
  move: number
  /** league average score at this race */
  leagueAvg: number
  /** chips this player played at this race */
  chips: ChipUse[]
  /** top scorer(s) of the weekend, including this player */
  weekendWinner: boolean
}

export interface PlayerProfile {
  player: Player
  lines: RaceLine[]
  avgPoints: number
  best: RaceLine | null
  worst: RaceLine | null
  /** weekends where this player had the top score (joint included) */
  wins: RaceLine[]
  racesLed: number
  podiums: number
  bestRank: { rank: number; race: string } | null
  worstRank: { rank: number; race: string } | null
  sprintAvg: number | null
  raceAvg: number | null
  chipUses: ChipUse[]
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function playerProfile(data: LeagueData, name: string): PlayerProfile | null {
  const player = data.players.find((p) => p.name === name)
  if (!player) return null

  const mine = data.chipUses.filter((u) => u.player === name)
  const lines: RaceLine[] = data.completed.flatMap((r) => {
    const points = r.gains[name]
    if (points === undefined) return []
    const all = Object.values(r.gains)
    return [
      {
        race: r.name,
        sprint: r.sprint,
        round: r.round,
        points,
        total: r.totals[name],
        rank: r.ranks[name],
        move: r.moves[name] ?? 0,
        leagueAvg: Math.round(all.reduce((a, b) => a + b, 0) / all.length),
        chips: mine.filter((u) => same(u.race, r.name)),
        weekendWinner: points === Math.max(...all),
      },
    ]
  })

  let best: RaceLine | null = null
  let worst: RaceLine | null = null
  let bestRank: PlayerProfile['bestRank'] = null
  let worstRank: PlayerProfile['worstRank'] = null
  for (const l of lines) {
    if (!best || l.points > best.points) best = l
    if (!worst || l.points < worst.points) worst = l
    if (!bestRank || l.rank < bestRank.rank) bestRank = { rank: l.rank, race: l.race }
    if (!worstRank || l.rank > worstRank.rank) worstRank = { rank: l.rank, race: l.race }
  }

  return {
    player,
    lines,
    avgPoints: mean(lines.map((l) => l.points)) ?? 0,
    best,
    worst,
    wins: lines.filter((l) => l.weekendWinner),
    racesLed: lines.filter((l) => l.rank === 1).length,
    podiums: lines.filter((l) => l.rank <= 3).length,
    bestRank,
    worstRank,
    sprintAvg: mean(lines.filter((l) => l.sprint).map((l) => l.points)),
    raceAvg: mean(lines.filter((l) => !l.sprint).map((l) => l.points)),
    chipUses: mine,
  }
}

export const chipUseFor = (profile: PlayerProfile, chip: ChipKey) => profile.chipUses.find((u) => u.chip === chip)
