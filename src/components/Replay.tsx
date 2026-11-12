import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { fmt, ordinal } from '../lib/format'
import { playerColour } from '../lib/playerColour'
import type { LeagueData } from '../lib/types'
import { Trophy } from './icons'

/** Cars charge forward for MOVE ms, then the rows swap for the overtakes, then the next race starts at STEP ms. */
const MOVE = 1300
const STEP = 3600
const SPEEDS = [1, 2, 4]

/** A number that counts from its previous value to the new one. */
function Tick({ value, ms, instant }: { value: number; ms: number; instant: boolean }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (instant || ms <= 0) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3)))
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms, instant])
  return <>{fmt(shown)}</>
}

export function Replay({ data }: { data: LeagueData }) {
  const races = data.completed
  const n = races.length
  const names = data.playerNames

  // idx = how many races have been run; phase 'move' = cars racing, 'swap' = rows reordering
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'move' | 'swap'>('swap')
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [instant, setInstant] = useState(true)
  const [follow, setFollow] = useState<string | null>(null)

  // the running order after every race (ties keep the previous order)
  const orders = useMemo(() => {
    // the grid starts alphabetical so it doesn't give away the final order
    const out: string[][] = [[...names].sort((a, b) => a.localeCompare(b))]
    races.forEach((r) => {
      const prev = out[out.length - 1]
      out.push([...names].sort((a, b) => (r.totals[b] ?? 0) - (r.totals[a] ?? 0) || prev.indexOf(a) - prev.indexOf(b)))
    })
    return out
  }, [races, names])

  // the track is the whole season: its end is the leader's final total, projected from their pace if the season isn't over
  const domain = useMemo(() => {
    if (n === 0) return 1
    const lead = Math.max(...names.map((p) => races[n - 1].totals[p] ?? 0))
    return Math.max(1, (lead * Math.max(data.races.length, n)) / n)
  }, [races, n, names, data.races.length])

  const i = Math.min(idx, n)
  const race = i > 0 ? races[i - 1] : null
  const totals = (p: string) => (race ? (race.totals[p] ?? 0) : 0)
  const gains = (p: string) => (race ? (race.gains[p] ?? 0) : 0)
  const shownOrder = phase === 'move' && i > 0 ? orders[i - 1] : orders[i]
  // the replay has reached the last scored race; it only crowns a champion once every race of the season is in
  const atEnd = i === n && n > 0
  const done = atEnd && n >= data.races.length
  // no positions until the first race has been run: the starting grid is just alphabetical
  const ranked = !!race && !(i === 1 && phase === 'move')

  // keep the replay valid if scores change underneath it
  useEffect(() => {
    if (idx > n) setIdx(n)
  }, [idx, n])

  // run the clock
  useEffect(() => {
    if (!playing) return
    let t: number
    if (phase === 'move') {
      t = window.setTimeout(() => setPhase('swap'), MOVE / speed)
    } else {
      t = window.setTimeout(
        () => {
          if (i < n) {
            setInstant(false)
            setIdx(i + 1)
            setPhase('move')
          } else setPlaying(false)
        },
        (i === 0 ? 500 : STEP - MOVE) / speed,
      )
    }
    return () => window.clearTimeout(t)
  }, [playing, phase, i, n, speed])

  // after an instant jump, switch the animations back on
  useEffect(() => {
    if (!instant) return
    const t = window.setTimeout(() => setInstant(false), 60)
    return () => window.clearTimeout(t)
  }, [instant, idx])

  const jump = (to: number) => {
    setPlaying(false)
    setInstant(true)
    setIdx(to)
    setPhase('swap')
  }
  const play = () => {
    if (playing) return setPlaying(false)
    if (i >= n) {
      setInstant(true)
      setIdx(0)
      setPhase('swap')
    }
    setPlaying(true)
  }

  // moves this weekend, and the commentary line
  const moves = useMemo(() => {
    const m: Record<string, number> = {}
    if (i > 1) names.forEach((p) => (m[p] = orders[i - 1].indexOf(p) - orders[i].indexOf(p)))
    return m
  }, [i, orders, names])
  const notes = useMemo(() => {
    if (!race || phase !== 'swap') return []
    const out: { key: string; text: string; tone?: 'up' | 'down' }[] = []
    const best = Math.max(...names.map((p) => gains(p)))
    const winner = names.find((p) => gains(p) === best)
    if (winner) out.push({ key: 'w', text: `${winner} wins the weekend, +${fmt(best)}` })
    if (i > 1) {
      const sorted = [...names].sort((a, b) => moves[b] - moves[a])
      const up = sorted[0]
      if (moves[up] > 0) out.push({ key: 'u', tone: 'up', text: `▲ ${up} climbs ${moves[up]} place${moves[up] > 1 ? 's' : ''} to ${ordinal(orders[i].indexOf(up) + 1)}` })
      const down = sorted[sorted.length - 1]
      if (moves[down] < -1) out.push({ key: 'd', tone: 'down', text: `▼ ${down} drops ${-moves[down]} to ${ordinal(orders[i].indexOf(down) + 1)}` })
      if (orders[i][0] !== orders[i - 1][0]) out.push({ key: 'l', text: `New leader: ${orders[i][0]}!` })
    }
    if (done) out.push({ key: 'c', text: `🏁 ${orders[i][0]} is the champion` })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race, phase, i, orders, moves, done])

  if (n === 0) return <p className="empty">The replay appears after the first race is scored.</p>

  const vars = {
    '--rp-move': instant ? '0s' : `${1.5 / speed}s`,
    '--rp-reorder': instant ? '0s' : `${0.9 / speed}s`,
  } as CSSProperties

  return (
    <section aria-labelledby="rp-h" className="rp" style={vars}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <symbol id="rp-car" viewBox="0 0 60 22">
          <rect x="1" y="2" width="4" height="11" fill="currentColor" />
          <rect x="0" y="1.5" width="7" height="2" fill="#111" />
          <path d="M5 14 L17 10.5 L29 9.5 L40 8 L52 12 L59 14 L59 16 L5 16 Z" fill="currentColor" />
          <path d="M17 10.5 L29 9.5 L40 8 L41 11 L16 13 Z" fill="#000" opacity=".18" />
          <circle cx="31" cy="6.6" r="3" fill="#fff" />
          <path d="M28.4 6.6h5.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M27.5 5.2 Q31 1.8 35 5.2" fill="none" stroke="#111" strokeWidth="1.1" />
          <rect x="52" y="16" width="8" height="2" fill="#111" />
          <g className="rp-wheel">
            <circle cx="14" cy="16.5" r="5" fill="#111" />
            <circle cx="14" cy="16.5" r="2" fill="#bbb" />
            <path d="M14 14.5v4M12 16.5h4" stroke="#555" strokeWidth=".8" />
          </g>
          <g className="rp-wheel">
            <circle cx="46" cy="16.5" r="5" fill="#111" />
            <circle cx="46" cy="16.5" r="2" fill="#bbb" />
            <path d="M46 14.5v4M44 16.5h4" stroke="#555" strokeWidth=".8" />
          </g>
        </symbol>
      </svg>

      <div className="section-head">
        <h2 id="rp-h">Season replay</h2>
        <p className="legend-note">The track is the whole season: the finish line is where the leader is on course to end up</p>
      </div>

      <div className="rp-race">
        <span key={i} className="rp-name">
          {race ? race.name : 'Lights out'}
        </span>
        {race?.sprint && <span className="rp-sprint">Sprint</span>}
        <span className="rp-round">{race ? `Round ${i} of ${data.races.length}` : 'Grid'}</span>
      </div>
      <div className="rp-feed" aria-live="polite">
        {notes.map((x, k) => (
          <span key={`${i}-${x.key}`} className={x.tone ? `rp-note ${x.tone}` : 'rp-note'} style={{ animationDelay: `${(k * 250) / speed}ms` }}>
            {x.text}
          </span>
        ))}
      </div>

      <div className="rp-controls">
        <button type="button" className="rp-btn" onClick={play}>
          {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
        </button>
        <button
          type="button"
          className="rp-btn ghost"
          onClick={() => {
            setInstant(true)
            setIdx(0)
            setPhase('swap')
            setPlaying(true)
          }}
        >
          Restart
        </button>
        <div className="rp-speed" role="group" aria-label="Speed">
          {SPEEDS.map((x) => (
            <button key={x} type="button" aria-pressed={speed === x} onClick={() => setSpeed(x)}>
              {x}×
            </button>
          ))}
        </div>
        <label className="rp-scrub">
          <span className="sr-only">Race</span>
          <input type="range" min={0} max={n} step={1} value={i} onChange={(e) => jump(+e.target.value)} />
          <small>{race ? `${i} / ${data.races.length}` : 'Start'}</small>
        </label>
      </div>

      <div className="rp-tower" style={{ height: `calc(${names.length} * var(--rp-rh))` }} role="list">
        {/* one continuous track behind the rows, so only the cars (not whole blocks) appear to change places */}
        <div className="rp-backing" aria-hidden="true" />
        {names.map((p) => {
          const pos = shownOrder.indexOf(p)
          const f = Math.min(1, Math.max(0, totals(p)) / domain)
          const d = phase === 'swap' ? moves[p] : 0
          const cls = ['rp-row']
          if (ranked && pos < 3) cls.push(`medal-${pos + 1}`)
          if (phase === 'move' && race) cls.push('moving')
          if (follow && follow !== p) cls.push('dim')
          const style = {
            '--i': pos,
            '--f': f,
            '--c': playerColour(names, p),
          } as CSSProperties
          return (
            <div key={p} role="listitem" className={cls.join(' ')} style={style} onClick={() => setFollow(follow === p ? null : p)}>
              <span className="rp-pos">{ranked ? pos + 1 : '–'}</span>
              {d ? <span className={d > 0 ? 'rp-badge up' : 'rp-badge down'}>{d > 0 ? '▲' : '▼'}{Math.abs(d)}</span> : null}
              <span className="rp-nm">
                <i className="rp-dot" />
                {p}
                {done && pos === 0 && <Trophy />}
              </span>
              <span className="rp-lane">
                <span className="rp-fill" />
                <span className="rp-car">
                  <svg aria-hidden="true">
                    <use href="#rp-car" />
                  </svg>
                </span>
              </span>
              <span className="rp-pts">
                {race && <span className={gains(p) < 0 ? 'rp-gain neg' : 'rp-gain'}>{gains(p) < 0 ? '−' : '+'}{fmt(Math.abs(gains(p)))}</span>}
                <Tick value={totals(p)} ms={1500 / speed} instant={instant} />
              </span>
            </div>
          )
        })}
      </div>
      <p className="legend-note rp-foot">Click a player to follow them.</p>
    </section>
  )
}
