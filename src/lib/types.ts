export const CHIPS = [
  { key: 'LL', name: 'Limitless', short: 'LL' },
  { key: 'WC', name: 'Wildcard', short: 'WC' },
  { key: 'FF', name: 'Final Fix', short: 'FF' },
  { key: 'AP', name: 'Autopilot', short: 'AP' },
  { key: 'NN', name: 'No Negative', short: 'NN' },
  { key: '3X', name: 'Extra DRS', short: '3X' },
] as const

export type ChipKey = (typeof CHIPS)[number]['key']

export interface Pick {
  code: string
  price: number
  /** true for the 2x-boosted driver */
  boosted?: boolean
}

export interface Player {
  name: string
  rank: number
  points: number
  /** points behind the player directly above (<= 0) */
  gap: number
  /** points behind the leader (<= 0) */
  leaderGap: number
  chips: Record<ChipKey, boolean>
  constructors: Pick[]
  drivers: Pick[]
  value: number
  cap: number
  budget: number
}

export interface Race {
  name: string
  sprint: boolean
  /** 1-based round number */
  round: number
  /** true once scores have been entered */
  complete: boolean
  /** cumulative points keyed by player name */
  totals: Record<string, number>
  /** points scored in this race keyed by player name */
  gains: Record<string, number>
  /** rank after this race (1 = leader) keyed by player name */
  ranks: Record<string, number>
  /** rank change versus the previous race (positive = moved up) */
  moves: Record<string, number>
}

export interface LeagueData {
  players: Player[]
  races: Race[]
  /** completed races only */
  completed: Race[]
  playerNames: string[]
}

export interface Highlight {
  id: string
  label: string
  value: string
  detail: string
  /** player names involved, used for colouring */
  players: string[]
}
