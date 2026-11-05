import seasonsJson from '../data/seasons.json'

export interface SeasonSources {
  leaderboard: string
  history: string
  colours: string
  chips: string
}

export interface Season {
  id: string
  /** archived seasons never poll the sheet: they are served from the bundled copy only */
  archived: boolean
  sources: SeasonSources
}

/** The four CSVs of one season, as bundled into the site. */
export interface BundledCsv {
  leaderboard: string
  history: string
  colours: string
  chips: string
}

export const CURRENT_SEASON: string = seasonsJson.current

/** Every season in the config, newest first. */
export const SEASONS: Season[] = Object.entries(seasonsJson.seasons as Record<string, Omit<Season, 'id'>>)
  .map(([id, s]) => ({ id, archived: s.archived, sources: s.sources }))
  .sort((a, b) => b.id.localeCompare(a.id))

export const getSeason = (id: string): Season => SEASONS.find((s) => s.id === id) ?? SEASONS[0]

const files = import.meta.glob('../data/*/*.csv', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

/** The bundled fallback copy of a season (src/data/<season>/*.csv). */
export function bundledFor(id: string): BundledCsv {
  const read = (name: string) => files[`../data/${id}/${name}.csv`] ?? ''
  return { leaderboard: read('leaderboard'), history: read('history'), colours: read('colours'), chips: read('chipusage') }
}
