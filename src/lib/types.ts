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
  /** the player's own fantasy team name (blank if the sheet has none) */
  teamName: string
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

/** Hex colours from the sheet's Colours tab, keyed by code (FER, ANT, LL ...). */
export interface Colours {
  teams: Record<string, string>
  drivers: Record<string, string>
  chips: Partial<Record<ChipKey, string>>
}

/** One chip played: who, which chip, at which race (and the driver swap for Final Fix). */
export interface ChipUse {
  player: string
  chip: ChipKey
  race: string
  /** Final Fix only: driver swapped out and the driver brought in */
  out?: string
  in?: string
  /** Final Fix only: points the swapped-out driver went on to score, and the driver brought in */
  outPoints?: number
  inPoints?: number
}

export interface LeagueData {
  players: Player[]
  colours: Colours
  races: Race[]
  /** completed races only */
  completed: Race[]
  playerNames: string[]
  /** from the Chip Usage tab; empty if that tab isn't available */
  chipUses: ChipUse[]
  /** from the optional Status tab */
  raceWeek: boolean
  /** optional message shown with the race-week banner */
  statusNote?: string
}

export interface Highlight {
  id: string
  label: string
  value: string
  detail: string
  /** player names involved, used for colouring */
  players: string[]
  /** set for chip facts, so they can be grouped and coloured by chip */
  chip?: ChipKey
}
