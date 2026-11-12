import { CURRENT_SEASON, SEASONS } from './seasons'

export type Tab = 'standings' | 'progress' | 'replay' | 'races' | 'stats'
export const TABS: { id: Tab; label: string }[] = [
  { id: 'standings', label: 'Standings' },
  { id: 'progress', label: 'Progress' },
  { id: 'races', label: 'Races' },
  { id: 'stats', label: 'Stats' },
  { id: 'replay', label: 'Replay' },
]

export type Route = { season: string; tab: Tab; player?: string }

/**
 * #standings, #player/Lewis                (current season: the short links that already exist)
 * #2025/standings, #2025/player/Lewis      (any other season)
 */
export function parseHash(hash: string): Route {
  let h = hash.replace('#', '')
  let season = CURRENT_SEASON
  const first = h.split('/')[0]
  if (SEASONS.some((s) => s.id === first)) {
    season = first
    h = h.slice(first.length + 1)
  }
  if (h.startsWith('player/')) {
    try {
      return { season, tab: 'standings', player: decodeURIComponent(h.slice('player/'.length)) }
    } catch {
      return { season, tab: 'standings' }
    }
  }
  const t = h as Tab
  return { season, tab: TABS.some((x) => x.id === t) ? t : 'standings' }
}

/** The hash for a page inside a season, e.g. hashFor('2025', 'standings') → '#2025/standings'. */
export const hashFor = (season: string, rest: string) => (season === CURRENT_SEASON ? `#${rest}` : `#${season}/${rest}`)

/** Browser-storage keys: the current season keeps the original keys so nothing saved is lost. */
export const scopedKey = (key: string, season: string) => (season === CURRENT_SEASON ? key : `${key}:${season}`)
