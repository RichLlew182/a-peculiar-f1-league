import { useEffect, useState } from 'react'
import { Recap } from './components/Recap'
import { PlayerPage } from './components/PlayerPage'
import { FormGuide } from './components/FormGuide'
import { ProgressChart } from './components/ProgressChart'
import { RaceList } from './components/RaceList'
import { Standings } from './components/Standings'
import { Stats } from './components/Stats'
import { Flag } from './components/icons'
import { ago } from './lib/format'
import { useLeagueData } from './lib/useLeagueData'

type Tab = 'standings' | 'progress' | 'races' | 'stats'
const TABS: { id: Tab; label: string }[] = [
  { id: 'standings', label: 'Standings' },
  { id: 'progress', label: 'Progress' },
  { id: 'races', label: 'Races' },
  { id: 'stats', label: 'Stats' },
]

type Route = { tab: Tab; player?: string }

const routeFromHash = (): Route => {
  const h = window.location.hash.replace('#', '')
  if (h.startsWith('player/')) {
    try {
      return { tab: 'standings', player: decodeURIComponent(h.slice('player/'.length)) }
    } catch {
      return { tab: 'standings' }
    }
  }
  const t = h as Tab
  return { tab: TABS.some((x) => x.id === t) ? t : 'standings' }
}

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
  const state = useLeagueData()
  const { data } = state
  const [route, setRoute] = useState<Route>(routeFromHash)
  const tab = route.tab
  const [theme, cycleTheme] = useTheme()
  const [, setNow] = useState(0)

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    // keep "x min ago" fresh
    const t = window.setInterval(() => setNow((n) => n + 1), 30_000)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.clearInterval(t)
    }
  }, [])

  const go = (t: Tab) => {
    setRoute({ tab: t })
    window.history.replaceState(null, '', `#${t}`)
  }

  if (!data) {
    return (
      <main className="page">
        <h1 className="title">A Peculiar F1 League 2026</h1>
        <p className="empty" role="alert">
          The league data couldn’t be read. {state.error} Check that both sheets are published as CSV.
        </p>
      </main>
    )
  }

  const latest = data.completed[data.completed.length - 1]
  const next = data.races.find((r) => !r.complete)

  const status =
    state.source === 'live'
      ? `Synced ${state.lastChecked ? ago(state.lastChecked) : ''}`
      : state.source === 'offline'
        ? 'Couldn’t reach the sheet. Showing the last saved scores.'
        : state.checking
          ? 'Checking the sheet…'
          : 'Showing saved scores'

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <h1 className="title">A Peculiar F1 League 2026</h1>
          <p className="subtitle">
            {latest ? `After ${latest.name}, round ${latest.round} of ${data.races.length}` : 'Season not started'}
            {next ? `. Next up: ${next.name}.` : '.'}
          </p>
          {data.races.length > 0 && (
            <div
              className="season-bar"
              role="progressbar"
              aria-label="Season progress"
              aria-valuemin={0}
              aria-valuemax={data.races.length}
              aria-valuenow={data.completed.length}
              aria-valuetext={`${data.completed.length} of ${data.races.length} races done`}
            >
              <div className="season-fill" style={{ width: `${(data.completed.length / data.races.length) * 100}%` }} />
              <Flag />
            </div>
          )}
        </div>
        <div className="status-col">
          <p className={`status ${state.source}`} role="status">
            <span className="dot" aria-hidden="true" />
            {status}
          </p>
          <div className="status-actions">
            <button type="button" className="link-btn" onClick={state.refresh} disabled={state.checking}>
              {state.checking ? 'Checking…' : 'Check for new scores'}
            </button>
            <button type="button" className="link-btn" onClick={cycleTheme} aria-label={`Colour theme: ${theme}. Change theme`}>
              Theme: {theme}
            </button>
          </div>
        </div>
      </header>

      {state.justUpdated && (
        <p className="toast" role="status">
          New scores found. The tables and charts have updated.
        </p>
      )}

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

      <main className="sheet">
        {route.player ? <PlayerPage data={data} name={route.player} /> : tab === 'standings' && <Standings data={data} />}
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

      <footer className="foot">
        <p>
          Scores come from the league spreadsheet and refresh every few minutes while this page is open.
        </p>
      </footer>
    </div>
  )
}
