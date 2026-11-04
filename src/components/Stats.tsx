import type { CSSProperties } from 'react'
import { fmt, money, textOn } from '../lib/format'
import { chipHighlights, highlights, ownership, playerStats } from '../lib/stats'
import { CHIPS, type LeagueData } from '../lib/types'

function Bars({ items, max, unit }: { items: { code: string; owners: number }[]; max: number; unit: string }) {
  return (
    <ul className="bars">
      {items.map((it) => (
        <li key={it.code}>
          <span className="bar-label">{it.code}</span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill" style={{ width: `${(it.owners / max) * 100}%` }} />
          </span>
          <span className="bar-value">
            {it.owners} <span className="muted-text">{unit}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function Stats({ data }: { data: LeagueData }) {
  if (data.completed.length === 0) return <p className="empty">Stats appear after the first race is scored.</p>
  const hl = highlights(data)
  const chipFacts = chipHighlights(data)
  const ps = playerStats(data).sort((a, b) => b.raceWins - a.raceWins || b.avgPerRace - a.avgPerRace)
  const own = ownership(data)
  const n = data.players.length

  // Cheapest/priciest squads give a feel for how people are spending.
  const byValue = [...data.players].sort((a, b) => b.value - a.value)

  return (
    <>
      <section aria-labelledby="hl-h">
        <div className="section-head">
          <h2 id="hl-h">Season highlights</h2>
          <p className="legend-note">
            After {data.completed.length} of {data.races.length} races
          </p>
        </div>
        <dl className="facts">
          {hl.map((h) => (
            <div key={h.id} className="fact">
              <dt>{h.label}</dt>
              <dd className="fact-value">{h.value}</dd>
              <dd className="fact-detail">{h.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      {chipFacts.length > 0 && (
        <section aria-labelledby="chip-h">
          <div className="section-head">
            <h2 id="chip-h">Chips</h2>
            <p className="legend-note">
              Best and worst compare the chip score with the best score that weekend by a player who didn’t play that
              chip
            </p>
          </div>
          {(['LL', '3X', 'NN', 'FF'] as const).map((key) => {
            const facts = chipFacts.filter((f) => f.chip === key)
            if (facts.length === 0) return null
            const def = CHIPS.find((c) => c.key === key)!
            const hex = data.colours.chips[key]
            const tint = hex ? ({ '--chip': hex, '--chip-ink': textOn(hex) } as CSSProperties) : undefined
            return (
              <div key={key} className="chip-group" style={tint}>
                <h3 className="chip-group-title">
                  <span className="chip used">{def.short}</span>
                  {def.name}
                </h3>
                <dl className="facts">
                  {facts.map((h) => (
                    <div key={h.id} className="fact">
                      <dt>{h.label}</dt>
                      <dd className="fact-value chip-value">{h.value}</dd>
                      <dd className="fact-detail">{h.detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
        </section>
      )}

      <section aria-labelledby="pl-h">
        <div className="section-head">
          <h2 id="pl-h">Player records</h2>
        </div>
        <div className="table-scroll">
          <table className="plain-table records">
            <caption className="sr-only">Season records for each player</caption>
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col" className="num">
                  Race wins
                </th>
                <th scope="col" className="num">
                  Weeks leading
                </th>
                <th scope="col" className="num">
                  Average
                </th>
                <th scope="col" className="num">
                  Best race
                </th>
                <th scope="col" className="num">
                  Worst race
                </th>
                <th scope="col" className="num">
                  Chips used
                </th>
              </tr>
            </thead>
            <tbody>
              {ps.map((s) => (
                <tr key={s.name}>
                  <th scope="row">{s.name}</th>
                  <td className="num">{s.raceWins}</td>
                  <td className="num">{s.racesLed}</td>
                  <td className="num">{Math.round(s.avgPerRace)}</td>
                  <td className="num">
                    {s.bestRace ? fmt(s.bestRace.points) : '–'} <span className="muted-text">{s.bestRace?.race}</span>
                  </td>
                  <td className="num">
                    {s.worstRace ? fmt(s.worstRace.points) : '–'}{' '}
                    <span className="muted-text">{s.worstRace?.race}</span>
                  </td>
                  <td className="num">{s.chipsUsed} of 6</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="own-h">
        <div className="section-head">
          <h2 id="own-h">
            Who everyone picked
            {data.completed.length > 0 ? ` in ${data.completed[data.completed.length - 1].name}` : ''}
          </h2>
          <p className="legend-note">Current teams, out of {n} players</p>
        </div>
        <div className="two-col">
          <div>
            <h3>Drivers</h3>
            <Bars items={own.drivers.slice(0, 10)} max={n} unit="teams" />
          </div>
          <div>
            <h3>Constructors</h3>
            <Bars items={own.constructors} max={n} unit="teams" />
            <h3 className="spaced">Team value</h3>
            <p className="note-line">
              Most valuable squad: <b>{byValue[0].name}</b> {money(byValue[0].value)}. Smallest:{' '}
              <b>{byValue[byValue.length - 1].name}</b> {money(byValue[byValue.length - 1].value)}.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
