import { fmt, ordinal, signedFmt } from '../lib/format'
import type { LeagueData } from '../lib/types'

export function RaceList({ data }: { data: LeagueData }) {
  const done = [...data.completed].reverse()
  const upcoming = data.races.filter((r) => !r.complete)
  if (done.length === 0) return null

  return (
    <section aria-labelledby="races-h">
      <div className="section-head">
        <h2 id="races-h">Race by race</h2>
        {upcoming.length > 0 && (
          <p className="legend-note">
            Still to come: {upcoming.map((r) => r.name).join(', ')}
          </p>
        )}
      </div>

      <div className="race-list">
        {done.map((r) => {
          const gains = Object.entries(r.gains).sort((a, b) => b[1] - a[1])
          const leader = Object.entries(r.ranks).find(([, rk]) => rk === 1)?.[0]
          const topPoints = gains[0]?.[1]
          const topScorers = gains
            .filter(([, g]) => g === topPoints)
            .map(([name]) => name)
            .sort((a, b) => a.localeCompare(b))
          return (
            <details key={r.name} className="race">
              <summary>
                <span className="race-round">R{r.round}</span>
                <span className="race-name">
                  {r.name}
                  {r.sprint && <span className="tag">Sprint</span>}
                </span>
                <span className="race-top">
                  Top score: <b>{topScorers.join(', ')}</b> {topPoints !== undefined ? fmt(topPoints) : ''}
                  {topScorers.length > 1 && <span className="tag">Joint</span>}
                </span>
                <span className="race-lead">
                  Leader: <b>{leader}</b>
                </span>
              </summary>
              <div className="table-scroll">
                <table className="plain-table race-table">
                  <caption className="sr-only">Results for {r.name}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Weekend</th>
                      <th scope="col">Player</th>
                      <th scope="col" className="num">
                        Points
                      </th>
                      <th scope="col" className="num">
                        Total
                      </th>
                      <th scope="col" className="num">
                        Position
                      </th>
                      <th scope="col" className="num">
                        Moved
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gains.map(([name, g], i) => {
                      const wk = i > 0 && g === gains[i - 1][1] ? gains.findIndex(([, v]) => v === g) + 1 : i + 1
                      const mv = r.moves[name] ?? 0
                      return (
                        <tr key={name}>
                          <td>{wk}</td>
                          <th scope="row">{name}</th>
                          <td className="num">{signedFmt(g)}</td>
                          <td className="num">{fmt(r.totals[name])}</td>
                          <td className="num">{ordinal(r.ranks[name])}</td>
                          <td className="num">
                            {mv === 0 ? (
                              <span className="muted-text">–</span>
                            ) : (
                              <span className={mv > 0 ? 'move up' : 'move down'}>
                                <span aria-hidden="true">{mv > 0 ? '▲' : '▼'}</span>
                                {Math.abs(mv)}
                                <span className="sr-only">{mv > 0 ? ' places up' : ' places down'}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
