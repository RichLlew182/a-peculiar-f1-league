import { useCallback, useEffect, useRef, useState } from 'react'
import sources from '../data/sources.json'
import bundledLeaderboard from '../data/leaderboard.csv?raw'
import bundledHistory from '../data/history.csv?raw'
import bundledColours from '../data/colours.csv?raw'
import { parseLeague } from './parse'
import type { LeagueData } from './types'

/** How often to re-check the sheet while the tab is open. */
const POLL_MS = 5 * 60 * 1000
/** Don't re-check more often than this when the tab regains focus. */
const MIN_GAP_MS = 20 * 1000
const CACHE_KEY = 'f1-fantasy:csv:v2'

export type SourceState = 'snapshot' | 'cached' | 'live' | 'offline'

export interface LeagueState {
  data: LeagueData | null
  error: string | null
  source: SourceState
  checking: boolean
  lastChecked: Date | null
  /** when the data last actually differed from what was shown */
  lastUpdated: Date | null
  /** briefly true after a refresh brought in new data */
  justUpdated: boolean
  refresh: () => void
}

interface Raw {
  leaderboard: string
  history: string
  colours: string
}

function readCache(): Raw | null {
  try {
    const v = localStorage.getItem(CACHE_KEY)
    if (!v) return null
    const o = JSON.parse(v)
    return typeof o?.leaderboard === 'string' && typeof o?.history === 'string'
      ? { leaderboard: o.leaderboard, history: o.history, colours: typeof o.colours === 'string' ? o.colours : bundledColours }
      : null
  } catch {
    return null
  }
}

function writeCache(raw: Raw) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(raw))
  } catch {
    /* storage unavailable: fine */
  }
}

async function fetchCsv(url: string): Promise<string> {
  // The extra query parameter sidesteps CDN/browser caching of the published CSV.
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}_=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  // A sign-in or error page comes back as HTML; never treat that as data.
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('Sheet is not published as CSV')
  return text
}

function tryParse(raw: Raw): LeagueData | null {
  try {
    const d = parseLeague(raw.leaderboard, raw.history, raw.colours)
    return d.players.length > 0 ? d : null
  } catch {
    return null
  }
}

export function useLeagueData(): LeagueState {
  const bundled: Raw = { leaderboard: bundledLeaderboard, history: bundledHistory, colours: bundledColours }
  const initial = useRef<{ raw: Raw; data: LeagueData | null; source: SourceState }>()
  if (!initial.current) {
    const cached = readCache()
    const cachedData = cached ? tryParse(cached) : null
    initial.current = cachedData
      ? { raw: cached as Raw, data: cachedData, source: 'cached' }
      : { raw: bundled, data: tryParse(bundled), source: 'snapshot' }
  }

  const [data, setData] = useState<LeagueData | null>(initial.current.data)
  const [source, setSource] = useState<SourceState>(initial.current.source)
  const [error, setError] = useState<string | null>(initial.current.data ? null : 'Could not read league data')
  const [checking, setChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [justUpdated, setJustUpdated] = useState(false)

  const rawRef = useRef<Raw>(initial.current.raw)
  const inFlight = useRef(false)
  const lastRun = useRef(0)

  const check = useCallback(async (force = false) => {
    if (inFlight.current) return
    if (!force && Date.now() - lastRun.current < MIN_GAP_MS) return
    inFlight.current = true
    lastRun.current = Date.now()
    setChecking(true)
    try {
      const [leaderboard, history, colours] = await Promise.all([
        fetchCsv(sources.leaderboard),
        fetchCsv(sources.history),
        // Colours are optional: if that tab can't be read, keep the ones we already have.
        fetchCsv(sources.colours).catch(() => rawRef.current.colours),
      ])
      const next: Raw = { leaderboard, history, colours }
      const parsed = tryParse(next)
      if (!parsed) throw new Error('Sheet changed shape and could not be read')

      const changed =
        next.leaderboard !== rawRef.current.leaderboard ||
        next.history !== rawRef.current.history ||
        next.colours !== rawRef.current.colours
      setSource('live')
      setError(null)
      setLastChecked(new Date())
      if (changed) {
        rawRef.current = next
        writeCache(next)
        setData(parsed)
        setLastUpdated(new Date())
        setJustUpdated(true)
        window.setTimeout(() => setJustUpdated(false), 6000)
      }
    } catch (e) {
      setLastChecked(new Date())
      setSource((s) => (s === 'live' ? 'offline' : s === 'snapshot' || s === 'cached' ? s : 'offline'))
      setError(e instanceof Error ? e.message : 'Could not reach the sheet')
    } finally {
      inFlight.current = false
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void check(true)
    const timer = window.setInterval(() => void check(), POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [check])

  const refresh = useCallback(() => void check(true), [check])

  return { data, error, source, checking, lastChecked, lastUpdated, justUpdated, refresh }
}
