import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fmt, ordinal, raceCode, signedFmt } from '../lib/format'
import type { LeagueData } from '../lib/types'
import { DataTable } from './DataTable'

type Metric = 'rank' | 'behind'

/** Four colours are validated for lines; beyond that identity gets unreliable. */
const MAX_SEL = 4
const STORE = 'f1-fantasy:progress:v1'
const SLOT_VAR = ['--s1', '--s2', '--s3', '--s4']

interface Stored {
  metric: Metric
  slots: Record<string, number>
}

function loadStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return null
    const o = JSON.parse(raw)
    if ((o.metric === 'rank' || o.metric === 'behind') && o.slots && typeof o.slots === 'object') return o
  } catch {
    /* ignore */
  }
  return null
}

function saveStored(s: Stored) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(760)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setW(el.clientWidth || 760)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Spread label positions so they keep a minimum gap, staying inside [lo, hi]. */
function spread(ys: number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  for (let k = 0; k < order.length; k++) {
    const min = k === 0 ? lo : order[k - 1].y + gap
    if (order[k].y < min) order[k].y = min
  }
  for (let k = order.length - 1; k >= 0; k--) {
    const max = k === order.length - 1 ? hi : order[k + 1].y - gap
    if (order[k].y > max) order[k].y = max
  }
  const out = new Array<number>(ys.length)
  for (const o of order) out[o.i] = o.y
  return out
}

export function ProgressChart({ data }: { data: LeagueData }) {
  const names = data.playerNames
  const [metric, setMetric] = useState<Metric>(() => loadStored()?.metric ?? 'rank')
  const [slots, setSlots] = useState<Record<string, number>>(() => {
    const st = loadStored()?.slots
    if (st && Object.keys(st).length > 0) return st
    return Object.fromEntries(names.slice(0, 3).map((n, i) => [n, i]))
  })
  const [hover, setHover] = useState<number | null>(null)
  const [wrapRef, wrapW] = useWidth<HTMLDivElement>()

  const sel = useMemo(
    () => Object.fromEntries(Object.entries(slots).filter(([n, s]) => names.includes(n) && s >= 0 && s < MAX_SEL)),
    [slots, names],
  )
  useEffect(() => saveStored({ metric, slots: sel }), [metric, sel])

  // On narrow screens the chart scrolls sideways; start at the latest race.
  const scrolled = useRef(false)
  useEffect(() => {
    const el = wrapRef.current
    if (el && !scrolled.current && el.scrollWidth > el.clientWidth + 1) {
      el.scrollLeft = el.scrollWidth
      scrolled.current = true
    }
  }, [wrapW, wrapRef])

  const toggle = (name: string) =>
    setSlots(() => {
      const cur = { ...sel }
      if (name in cur) {
        delete cur[name]
        return cur
      }
      const used = new Set(Object.values(cur))
      if (used.size >= MAX_SEL) return cur
      let slot = 0
      while (used.has(slot)) slot++
      return { ...cur, [name]: slot }
    })

  const races = data.races
  const done = data.completed
  if (done.length === 0) {
    return <p className="empty">No races have been scored yet. The chart appears after the first race.</p>
  }

  let lastIdx = 0
  races.forEach((r, i) => {
    if (r.complete) lastIdx = i
  })
  const lastRace = races[lastIdx]
  const n = names.length

  // ---- geometry -------------------------------------------------------
  const W = Math.max(wrapW, 760)
  const H = 440
  const m = { top: 18, right: wrapW < 560 ? 84 : 108, bottom: 44, left: 40 }
  const plotW = W - m.left - m.right
  const plotH = H - m.top - m.bottom
  const step = races.length > 1 ? plotW / (races.length - 1) : plotW
  const xOf = (i: number) => m.left + i * step

  const behindOf = (raceIdx: number, name: string) => {
    const r = races[raceIdx]
    const lead = Math.max(...Object.values(r.totals))
    return lead - (r.totals[name] ?? lead)
  }
  let maxBehind = 0
  for (let i = 0; i <= lastIdx; i++) {
    if (!races[i].complete) continue
    for (const nm of names) if (races[i].totals[nm] !== undefined) maxBehind = Math.max(maxBehind, behindOf(i, nm))
  }
  const tickStep = maxBehind > 2400 ? 1000 : 500
  const niceMax = Math.max(tickStep, Math.ceil(maxBehind / tickStep) * tickStep)

  const yRank = (rank: number) => m.top + ((rank - 1) / Math.max(1, n - 1)) * plotH
  const yBehind = (b: number) => m.top + (b / niceMax) * plotH
  const yFor = (raceIdx: number, name: string) =>
    metric === 'rank' ? yRank(races[raceIdx].ranks[name]) : yBehind(behindOf(raceIdx, name))

  const ticks =
    metric === 'rank'
      ? Array.from({ length: n }, (_, i) => ({ v: i + 1, y: yRank(i + 1), label: String(i + 1) }))
      : Array.from({ length: niceMax / tickStep + 1 }, (_, i) => ({
          v: i * tickStep,
          y: yBehind(i * tickStep),
          label: i === 0 ? '0' : fmt(i * tickStep),
        }))

  const series = names.map((name) => {
    const pts: { i: number; x: number; y: number }[] = []
    for (let i = 0; i <= lastIdx; i++) {
      if (races[i].complete && races[i].totals[name] !== undefined) pts.push({ i, x: xOf(i), y: yFor(i, name) })
    }
    const d = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    return { name, pts, d, slot: sel[name] as number | undefined }
  })
  const muted = series.filter((s) => s.slot === undefined)
  const picked = series.filter((s) => s.slot !== undefined)

  // End labels: everyone in position mode (positions never collide), selected only otherwise.
  const labelled = metric === 'rank' ? series : picked
  const endYs = labelled.map((s) => s.pts[s.pts.length - 1]?.y ?? 0)
  const labelYs = spread(endYs, 14, m.top, m.top + plotH)

  // ---- hover ----------------------------------------------------------
  const clampIdx = (i: number) => Math.min(lastIdx, Math.max(0, i))
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    setHover(clampIdx(Math.round((e.clientX - box.left - m.left) / step)))
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setHover((h) => clampIdx((h ?? lastIdx + 1) - 1))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setHover((h) => clampIdx((h ?? -1) + 1))
    } else if (e.key === 'Escape') {
      setHover(null)
    }
  }

  const hoverRace = hover !== null ? races[hover] : null
  const hoverRows = hoverRace
    ? names
        .filter((nm) => hoverRace.ranks[nm] !== undefined)
        .map((nm) => ({ name: nm, rank: hoverRace.ranks[nm], total: hoverRace.totals[nm], behind: behindOf(hover as number, nm) }))
        .sort((a, b) => a.rank - b.rank)
    : []
  const hx = hover !== null ? xOf(hover) : 0
  const flip = hx > W * 0.55

  // ---- summary line ---------------------------------------------------
  const ranked = Object.entries(lastRace.totals).sort((a, b) => b[1] - a[1])
  const summary =
    ranked.length > 1
      ? `After ${lastRace.name}, ${ranked[0][0]} leads ${ranked[1][0]} by ${fmt(ranked[0][1] - ranked[1][1])} points.`
      : `After ${lastRace.name}.`

  return (
    <section aria-labelledby="progress-h">
      <div className="section-head">
        <h2 id="progress-h">Season progress</h2>
        <div className="seg" role="group" aria-label="Chart measure">
          <button type="button" aria-pressed={metric === 'rank'} onClick={() => setMetric('rank')}>
            Position
          </button>
          <button type="button" aria-pressed={metric === 'behind'} onClick={() => setMetric('behind')}>
            Points behind leader
          </button>
        </div>
      </div>
      <p className="lede">{summary}</p>

      <div className="picker">
        <p className="picker-help">Highlight up to {MAX_SEL} players. Everyone else stays grey.</p>
        <ul className="picker-list">
          {names.map((nm) => {
            const slot = sel[nm]
            const on = slot !== undefined
            const full = !on && Object.keys(sel).length >= MAX_SEL
            return (
              <li key={nm}>
                <button
                  type="button"
                  className={on ? 'pick-btn on' : 'pick-btn'}
                  aria-pressed={on}
                  aria-disabled={full}
                  title={full ? `Up to ${MAX_SEL} players at once. Deselect one first.` : undefined}
                  onClick={() => !full && toggle(nm)}
                >
                  <svg width="18" height="10" aria-hidden="true">
                    <line
                      x1="1"
                      x2="17"
                      y1="5"
                      y2="5"
                      strokeWidth={on ? 2 : 1.5}
                      strokeLinecap="round"
                      stroke={on ? `var(${SLOT_VAR[slot]})` : 'var(--gray-line)'}
                    />
                  </svg>
                  {nm}
                </button>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          className="link-btn"
          onClick={() => setSlots(Object.fromEntries(names.slice(0, 3).map((nm, i) => [nm, i])))}
        >
          Reset to top 3
        </button>
      </div>

      <div className="chart-wrap" ref={wrapRef}>
        <div className="chart-inner" style={{ width: W, height: H }}>
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="group"
            tabIndex={0}
            aria-label={`${metric === 'rank' ? 'Position' : 'Points behind the leader'} after each race. Use the left and right arrow keys to inspect each race.`}
            onKeyDown={onKey}
            onFocus={() => setHover((h) => h ?? lastIdx)}
            onBlur={() => setHover(null)}
          >
            {/* grid + y axis */}
            {ticks.map((t) => (
              <g key={t.v}>
                <line x1={m.left} x2={W - m.right} y1={t.y} y2={t.y} stroke={t.v === (metric === 'rank' ? 1 : 0) ? 'var(--axis)' : 'var(--grid)'} strokeWidth="1" />
                <text x={m.left - 8} y={t.y + 4} textAnchor="end" className="tick">
                  {t.label}
                </text>
              </g>
            ))}

            {/* x axis: every race in the season, future ones faded */}
            {races.map((r, i) => (
              <g key={r.name + i} opacity={r.complete ? 1 : 0.45}>
                <text x={xOf(i)} y={H - m.bottom + 18} textAnchor="middle" className="tick xt">
                  {raceCode(r.name)}
                </text>
                {r.sprint && (
                  <text x={xOf(i)} y={H - m.bottom + 30} textAnchor="middle" className="tick sprint-mark">
                    Sp
                  </text>
                )}
              </g>
            ))}

            {/* crosshair */}
            {hover !== null && (
              <line x1={hx} x2={hx} y1={m.top - 6} y2={m.top + plotH + 6} stroke="var(--axis)" strokeWidth="1" />
            )}

            {/* context lines first, highlighted lines on top */}
            {muted.map((s) => (
              <path key={s.name} d={s.d} fill="none" stroke="var(--gray-line)" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {picked.map((s) => (
              <path
                key={s.name}
                d={s.d}
                fill="none"
                stroke={`var(${SLOT_VAR[s.slot as number]})`}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {/* end dots with a surface ring */}
            {picked.map((s) => {
              const p = s.pts[s.pts.length - 1]
              return p ? (
                <circle key={s.name} cx={p.x} cy={p.y} r="4.5" fill={`var(${SLOT_VAR[s.slot as number]})`} stroke="var(--surface)" strokeWidth="2" />
              ) : null
            })}

            {/* hover dots */}
            {hover !== null &&
              picked.map((s) => {
                const p = s.pts.find((q) => q.i === hover)
                return p ? (
                  <circle key={s.name} cx={p.x} cy={p.y} r="4.5" fill={`var(${SLOT_VAR[s.slot as number]})`} stroke="var(--surface)" strokeWidth="2" />
                ) : null
              })}

            {/* end labels */}
            {labelled.map((s, k) => {
              const end = s.pts[s.pts.length - 1]
              if (!end) return null
              const isSel = s.slot !== undefined
              const ly = labelYs[k]
              const lx = end.x + 14
              return (
                <g key={s.name} className="end-label" aria-hidden="true" onClick={() => toggle(s.name)}>
                  {Math.abs(ly - end.y) > 1 && <line x1={end.x + 4} y1={end.y} x2={lx - 3} y2={ly} stroke="var(--axis)" strokeWidth="1" />}
                  <text x={lx} y={ly + 4} className={isSel ? 'label sel' : 'label'}>
                    {s.name}
                  </text>
                </g>
              )
            })}

            {/* pointer capture */}
            <rect
              x={m.left - 6}
              y={m.top - 10}
              width={plotW + 12}
              height={plotH + 20}
              fill="transparent"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>

          {hoverRace && (
            <div
              className="tip"
              role="status"
              style={{ top: 6, ...(flip ? { right: W - hx + 14 } : { left: hx + 14 }) }}
            >
              <p className="tip-title">
                {hoverRace.name}
                {hoverRace.sprint ? ' (sprint weekend)' : ''}
              </p>
              <ul>
                {hoverRows.map((r) => {
                  const slot = sel[r.name]
                  const on = slot !== undefined
                  return (
                    <li key={r.name} className={on ? 'on' : ''}>
                      <svg width="14" height="8" aria-hidden="true">
                        <line x1="1" x2="13" y1="4" y2="4" strokeWidth={on ? 2 : 1.25} strokeLinecap="round" stroke={on ? `var(${SLOT_VAR[slot]})` : 'var(--gray-line)'} />
                      </svg>
                      <span className="tip-rank">{ordinal(r.rank)}</span>
                      <span className="tip-name">{r.name}</span>
                      <b>{fmt(r.total)}</b>
                      <span className="tip-gap">{r.behind === 0 ? 'leader' : signedFmt(-r.behind)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <details className="table-view">
        <summary>View as table</summary>
        <DataTable
          caption={
            metric === 'rank'
              ? 'Championship position after each race'
              : 'Points behind the leader after each race (0 means leading)'
          }
          corner="Race"
          columns={names}
          rows={done.map((r) => ({
            label: r.name + (r.sprint ? ' (sprint)' : ''),
            cells: names.map((nm) =>
              r.ranks[nm] === undefined ? '–' : metric === 'rank' ? r.ranks[nm] : behindOf(r.round - 1, nm),
            ),
          }))}
        />
      </details>
    </section>
  )
}
