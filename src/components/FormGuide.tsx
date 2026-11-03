import { useState } from 'react'
import { fmt, ordinal, raceCode } from '../lib/format'
import type { LeagueData, Race } from '../lib/types'

/** Rank each player by points scored in one race (ties share a rank). */
function weekendRanks(race: Race): Record<string, number> {
  const ordered = Object.entries(race.gains).sort((a, b) => b[1] - a[1])
  const out: Record<string, number> = {}
  ordered.forEach(([name, g], i) => {
    out[name] = i > 0 && g === ordered[i - 1][1] ? out[ordered[i - 1][0]] : i + 1
  })
  return out
}

/** 14 players -> 7 shades, best weekend finishers darkest. */
const bin = (rank: number) => 6 - Math.min(6, Math.floor((rank - 1) / 2))

interface Tip {
  x: number
  y: number
  name: string
  race: string
  gain: number
  weekendRank: number
  of: number
  total: number
}

export function FormGuide({ data }: { data: LeagueData }) {
  const [tip, setTip] = useState<Tip | null>(null)
  const done = data.completed
  if (done.length === 0) return null
  const ranks = done.map(weekendRanks)

  return (
    <section aria-labelledby="form-h">
      <div className="section-head">
        <h2 id="form-h">Form guide</h2>
        <p className="legend-note">
          Points scored each weekend, shaded by finishing position within the league: green is higher, red is lower.
        </p>
      </div>

      <div className="heat-legend" aria-hidden="true">
        <span>Lower</span>
        {[0, 1, 2, 3, 4, 5, 6].map((b) => (
          <i key={b} className={`h${b}`} />
        ))}
        <span>Higher</span>
      </div>

      <div className="table-scroll" onPointerLeave={() => setTip(null)}>
        <table className="heat">
          <caption className="sr-only">Points scored by each player at each race, shaded by weekend finishing position</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky-col">
                Player
              </th>
              {done.map((r) => (
                <th key={r.name} scope="col" title={r.name + (r.sprint ? ' (sprint weekend)' : '')}>
                  {raceCode(r.name)}
                  {r.sprint && <span className="sp">Sp</span>}
                </th>
              ))}
              <th scope="col" className="total-col">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.name}>
                <th scope="row" className="sticky-col">
                  {p.name}
                </th>
                {done.map((r, i) => {
                  const g = r.gains[p.name]
                  if (g === undefined) return <td key={r.name}>–</td>
                  const wr = ranks[i][p.name]
                  return (
                    <td
                      key={r.name}
                      className={`h${bin(wr)}`}
                      onPointerMove={(e) =>
                        setTip({
                          x: e.clientX,
                          y: e.clientY,
                          name: p.name,
                          race: r.name,
                          gain: g,
                          weekendRank: wr,
                          of: Object.keys(r.gains).length,
                          total: r.totals[p.name],
                        })
                      }
                    >
                      {g}
                    </td>
                  )
                })}
                <td className="total-col">{fmt(p.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tip && (
        <div className="tip fixed" style={{ left: Math.min(tip.x + 14, window.innerWidth - 200), top: tip.y + 14 }} role="status">
          <p className="tip-title">{tip.name}</p>
          <p>
            <b>{tip.gain} pts</b> at {tip.race}
          </p>
          <p className="tip-gap">
            {ordinal(tip.weekendRank)} of {tip.of} that weekend · total {fmt(tip.total)}
          </p>
        </div>
      )}
    </section>
  )
}
