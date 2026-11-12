import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { fmt, ordinal } from '../lib/format'
import { playerColour } from '../lib/playerColour'
import type { LeagueData } from '../lib/types'
import { Fireworks } from './Fireworks'
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
  // bumped when the replay reaches the end of a finished season, to set the fireworks off
  const [celebrate, setCelebrate] = useState(0)

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

  useEffect(() => {
    if (playing && phase === 'swap' && done) setCelebrate((c) => c + 1)
  }, [playing, phase, done])

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
        <symbol id="rp-car" viewBox="0 0 60 16">
          <path d="M0 2.6 H6.6 L7 9.2 H0.6 Z" fill="currentColor"/>
          <path d="M0 2.6 H6.6 V3.7 H0.1 Z" fill="#000" opacity=".25"/>
          <path d="M0.4 9.2 H7.4 V10.4 H0.7 Z" fill="#111"/>
          <path d="M5.5 10.4 H8 L9 13.6 H6.4 Z" fill="#111"/>
          <path d="M6.4 9 C9 7.4 13 6.6 18 6.1 L22.6 4.2 L27.4 4.3 L29.6 6.2 L37 6.7 C44 7.2 51 9.2 59.6 12.2 V13.3 L51 13.3 L48 14.4 H11 L6.4 13 Z" fill="currentColor"/>
          <path d="M12 13 L50 12.6 L48.6 14.4 H11 Z" fill="#000" opacity=".28"/>
          <path d="M30.5 9 H39 L40.6 10.8 H31.6 Z" fill="#000" opacity=".3"/>
          <path d="M23 4.4 L27.2 4.5 L28.6 6 L21.4 5.8 Z" fill="#000" opacity=".35"/>
          <circle cx="32.8" cy="4.9" r="1.6" fill="#f4f4f4"/>
          <path d="M33.4 4.5 H34.8 V5.3 H33.4 Z" fill="#111"/>
          <path d="M30.2 6.4 Q33 2.6 36.6 6.7" fill="none" stroke="#111" strokeWidth=".8" strokeLinecap="round"/>
          <path d="M52 13.9 H59.8 V15 H51 Z" fill="#111"/>
          <g className="rp-wheel"><circle cx="10" cy="11" r="4" fill="#111"/><circle cx="10" cy="11" r="2" fill="#aab"/><path d="M10 9.4v3.2M8.4 11h3.2" stroke="#555" strokeWidth=".7"/></g>
          <g className="rp-wheel"><circle cx="46" cy="11" r="4" fill="#111"/><circle cx="46" cy="11" r="2" fill="#aab"/><path d="M46 9.4v3.2M44.4 11h3.2" stroke="#555" strokeWidth=".7"/></g>
        </symbol>
      </svg>

      <div className="section-head">
        <h2 id="rp-h">Season replay</h2>
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
        <Fireworks key={celebrate} on={celebrate > 0 && done} />
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
