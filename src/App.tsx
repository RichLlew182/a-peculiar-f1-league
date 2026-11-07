import { useEffect, useRef, useState } from 'react'
import { Recap } from './components/Recap'
import { PlayerPage } from './components/PlayerPage'
import { FormGuide } from './components/FormGuide'
import { ProgressChart } from './components/ProgressChart'
import { RaceList } from './components/RaceList'
import { Standings } from './components/Standings'
import { Stats } from './components/Stats'
import { ago } from './lib/format'
import { hashFor, parseHash, TABS, type Route, type Tab } from './lib/route'
import { SeasonContext } from './lib/SeasonContext'
import { getSeason, SEASONS } from './lib/seasons'
import { useLeagueData } from './lib/useLeagueData'

type Theme = 'system' | 'light' | 'dark'
const THEME_KEY = 'f1-fantasy:theme'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const v = localStorage.getItem(THEME_KEY)
      return v === 'light' || v === 'dark' ? v : 'system'
    } catch {
      return 'system'
    }
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])
  const next = () => setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system'))
  return [theme, next] as const
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  const [theme, cycleTheme] = useTheme()

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (t: Tab) => {
    setRoute({ season: route.season, tab: t })
    window.history.replaceState(null, '', hashFor(route.season, t))
  }
  const pickSeason = (id: string) => {
    window.location.hash = hashFor(id, 'standings')
  }

  const season = getSeason(route.season)
  const ctx = { id: season.id, href: (rest: string) => hashFor(season.id, rest) }
  // key: switching season starts from a clean slate (its own data, polling and state)
  return (
    <SeasonContext.Provider value={ctx}>
      <SeasonView
        key={season.id}
        seasonId={season.id}
        route={route}
        go={go}
        pickSeason={pickSeason}
        theme={theme}
        cycleTheme={cycleTheme}
      />
    </SeasonContext.Provider>
  )
}

/** The picker in the masthead: a plain year until there is more than one season. */
function SeasonPicker({ current, onPick }: { current: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (SEASONS.length < 2) return <span className="year">{current}</span>
  return (
    <span className="season-pick" ref={ref}>
      <button
        type="button"
        className="season-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Season: ${current}. Change season`}
        onClick={() => setOpen((o) => !o)}
      >
        {current}
      </button>
      {open && (
        <ul className="season-menu" role="listbox" aria-label="Season">
          {SEASONS.map((s) => (
            <li key={s.id} role="option" aria-selected={s.id === current}>
              <button
                type="button"
                className="season-opt"
                onClick={() => {
                  setOpen(false)
                  if (s.id !== current) onPick(s.id)
                }}
              >
                {s.id}
                {s.archived && <small>Archived</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}

function SeasonView({
  seasonId,
  route,
  go,
  pickSeason,
  theme,
  cycleTheme,
}: {
  seasonId: string
  route: Route
  go: (t: Tab) => void
  pickSeason: (id: string) => void
  theme: Theme
  cycleTheme: () => void
}) {
  const season = getSeason(seasonId)
  const state = useLeagueData(seasonId)
  const { data } = state
  const tab = route.tab
  const [, setNow] = useState(0)

  useEffect(() => {
    // keep "x min ago" fresh
    const t = window.setInterval(() => setNow((n) => n + 1), 30_000)
    return () => window.clearInterval(t)
  }, [])

  if (!data) {
    return (
      <main className="page">
        <h1 className="title">A Peculiar F1 League {seasonId}</h1>
        <p className="empty" role="alert">
          The league data couldn’t be read. {state.error} Check that both sheets are published as CSV.
        </p>
      </main>
    )
  }

  const latest = data.completed[data.completed.length - 1]
  const next = data.races.find((r) => !r.complete)

  const finished = !next && !!latest
  const status = season.archived
    ? 'Archived season'
    : state.source === 'live'
      ? `Synced ${state.lastChecked ? ago(state.lastChecked) : ''}`
      : state.source === 'offline'
        ? 'Couldn’t reach the sheet. Showing the last saved scores.'
        : state.checking
          ? 'Checking the sheet…'
          : 'Showing saved scores'

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div>
            <h1 className="title">
              A Peculiar F1 League <SeasonPicker current={seasonId} onPick={pickSeason} />
            </h1>
            <p className="subtitle">
              {finished
                ? `Final standings after ${latest.name}, all ${data.races.length} races done.`
                : `${latest ? `After ${latest.name}, round ${latest.round} of ${data.races.length}` : 'Season not started'}${next ? `. Next up: ${next.name}.` : '.'}`}
            </p>
          </div>
          <div className="status-col">
            <p className={`status ${state.source}`} role="status">
              <span className="dot" aria-hidden="true" />
              {status}
            </p>
            <div className="status-actions">
              {!season.archived && (
                <button type="button" className="link-btn" onClick={state.refresh} disabled={state.checking}>
                  {state.checking ? 'Checking…' : 'Check for new scores'}
                </button>
              )}
              <button
                type="button"
                className="link-btn"
                onClick={cycleTheme}
                aria-label={`Colour theme: ${theme}. Change theme`}
              >
                Theme: {theme}
              </button>
            </div>
          </div>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tab"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="page">
        {state.justUpdated && (
          <p className="toast" role="status">
            New scores found. The tables and charts have updated.
          </p>
        )}

        <main className="sheet">
          {route.player ? (
            <PlayerPage data={data} name={route.player} />
          ) : (
            tab === 'standings' && <Standings data={data} />
          )}
          {tab === 'progress' && <ProgressChart data={data} />}
          {tab === 'races' && (
            <>
              <Recap data={data} />
              <FormGuide data={data} />
              <RaceList data={data} />
            </>
          )}
          {tab === 'stats' && <Stats data={data} />}
        </main>

        {season.archived && (
          <footer className="foot">
            <p>This season is archived, so these scores no longer change.</p>
          </footer>
        )}
      </div>
    </>
  )
}
