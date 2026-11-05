import { useEffect, useMemo, useRef, useState } from 'react'
import { fmt, ordinal, raceCode, signedFmt } from '../lib/format'
import { useWidth } from '../lib/useWidth'
import type { LeagueData } from '../lib/types'
import { DataTable } from './DataTable'

type Metric = 'rank' | 'behind'

/** Highlighting more than a handful of lines stops being readable. */
const MAX_SEL = 4
const STORE = 'f1-fantasy:progress:v1'
/** Size of the colour palette. With more than 8 players some hues repeat. */
const HUES = 8

interface Stored {
  metric: Metric
  selected: string[]
}

function loadStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (o.metric === 'rank' || o.metric === 'behind') {
      // earlier versions stored { slots: { name: slot } }
      const list: unknown = Array.isArray(o.selected)
        ? o.selected
        : o.slots && typeof o.slots === 'object'
          ? Object.keys(o.slots)
          : null
      if (Array.isArray(list)) {
        return { metric: o.metric, selected: list.filter((s): s is string => typeof s === 'string') }
      }
    }
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
  const [selectedRaw, setSelected] = useState<string[]>(() => {
    const st = loadStored()?.selected
    return st && st.length > 0 ? st : names.slice(0, 3)
  })
  const [hover, setHover] = useState<number | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const [wrapRef, wrapW] = useWidth<HTMLDivElement>()

  const selected = useMemo(() => selectedRaw.filter((n) => names.includes(n)).slice(0, MAX_SEL), [selectedRaw, names])
  const isSel = (name: string) => selected.includes(name)
  useEffect(() => saveStored({ metric, selected }), [metric, selected])

  // Every player keeps one hue for good. Alphabetical order keeps it from shifting as rankings change.
  const hueOf = useMemo(() => {
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    return (name: string) => `var(--s${(sorted.indexOf(name) % HUES) + 1})`
  }, [names])

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
    setSelected(() => {
      if (selected.includes(name)) return selected.filter((n) => n !== name)
      return selected.length >= MAX_SEL ? selected : [...selected, name]
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
  const m = { top: 18, right: wrapW < 560 ? 84 : 108, bottom: 44, left: 48 }
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
          label: i === 0 ? '0' : signedFmt(-i * tickStep),
        }))

  const series = names.map((name) => {
    const pts: { i: number; x: number; y: number }[] = []
    for (let i = 0; i <= lastIdx; i++) {
      if (races[i].complete && races[i].totals[name] !== undefined) pts.push({ i, x: xOf(i), y: yFor(i, name) })
    }
    const d = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    return { name, pts, d, on: isSel(name) }
  })
  const muted = series.filter((s) => !s.on)
  const picked = series.filter((s) => s.on)

  // End labels for everyone. Where lines bunch up, labels are spread apart and joined to their line.
  const labelled = series
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
        <p className="picker-help">Highlight up to {MAX_SEL} players. Everyone else is shown faded in their own colour.</p>
        <ul className="picker-list">
          {names.map((nm) => {
            const on = isSel(nm)
            const full = !on && selected.length >= MAX_SEL
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
                      stroke={hueOf(nm)}
                      strokeOpacity={on ? 1 : 0.5}
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
          onClick={() => setSelected(names.slice(0, 3))}
        >
          Reset to top 3
        </button>
      </div>

      <div className="chart-wrap" ref={wrapRef} onScroll={() => setHover(null)}>
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
              <path
                key={s.name}
                d={s.d}
                fill="none"
                stroke={hueOf(s.name)}
                strokeOpacity="0.4"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {picked.map((s) => (
              <path
                key={s.name}
                d={s.d}
                fill="none"
                stroke={hueOf(s.name)}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {/* end dots with a surface ring */}
            {picked.map((s) => {
              const p = s.pts[s.pts.length - 1]
              return p ? (
                <circle key={s.name} cx={p.x} cy={p.y} r="4.5" fill={hueOf(s.name)} stroke="var(--surface)" strokeWidth="2" />
              ) : null
            })}

            {/* small faded dots mark the end of every other line */}
            {muted.map((s) => {
              const p = s.pts[s.pts.length - 1]
              return p ? <circle key={s.name} cx={p.x} cy={p.y} r="2.5" fill={hueOf(s.name)} opacity="0.5" /> : null
            })}

            {/* hover dots */}
            {hover !== null &&
              picked.map((s) => {
                const p = s.pts.find((q) => q.i === hover)
                return p ? (
                  <circle key={s.name} cx={p.x} cy={p.y} r="4.5" fill={hueOf(s.name)} stroke="var(--surface)" strokeWidth="2" />
                ) : null
              })}

            {/* end labels */}
            {labelled.map((s, k) => {
              const end = s.pts[s.pts.length - 1]
              if (!end) return null
              const on = s.on
              const ly = labelYs[k]
              const lx = end.x + 14
              return (
                <g key={s.name} className="end-label" aria-hidden="true" onClick={() => toggle(s.name)}>
                  {Math.abs(ly - end.y) > 1 && <line x1={end.x + 4} y1={end.y} x2={lx - 3} y2={ly} stroke="var(--axis)" strokeWidth="1" />}
                  <text
                    x={lx}
                    y={ly + 4}
                    className={on ? 'label sel' : 'label'}
                    style={{ fill: `color-mix(in srgb, ${hueOf(s.name)} ${on ? 80 : 62}%, var(--ink))` }}
                  >
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
              // Mouse: follow the pointer. Touch: only a tap (little movement) shows the popup,
              // so scrolling the chart with a finger doesn't.
              onPointerMove={(e) => e.pointerType !== 'touch' && onMove(e)}
              onPointerDown={(e) => {
                if (e.pointerType !== 'touch') return onMove(e)
                touchStart.current = { x: e.clientX, y: e.clientY }
              }}
              onPointerUp={(e) => {
                if (e.pointerType !== 'touch' || !touchStart.current) return
                const moved = Math.hypot(e.clientX - touchStart.current.x, e.clientY - touchStart.current.y)
                touchStart.current = null
                if (moved > 10) return
                const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
                const i = clampIdx(Math.round((e.clientX - box.left - m.left) / step))
                setHover((h) => (h === i ? null : i))
              }}
              onPointerCancel={() => {
                touchStart.current = null
              }}
              onPointerLeave={(e) => e.pointerType !== 'touch' && setHover(null)}
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
                  const on = isSel(r.name)
                  return (
                    <li key={r.name} className={on ? 'on' : ''}>
                      <svg width="14" height="8" aria-hidden="true">
                        <line x1="1" x2="13" y1="4" y2="4" strokeWidth={on ? 2 : 1.5} strokeLinecap="round" stroke={hueOf(r.name)} strokeOpacity={on ? 1 : 0.5} />
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
              : 'Gap to the leader after each race (0 means leading)'
          }
          corner="Race"
          columns={names}
          rows={done.map((r) => ({
            label: r.name + (r.sprint ? ' (sprint)' : ''),
            cells: names.map((nm) =>
              r.ranks[nm] === undefined ? '–' : metric === 'rank' ? r.ranks[nm] : signedFmt(-behindOf(r.round - 1, nm)),
            ),
          }))}
        />
      </details>
    </section>
  )
}
