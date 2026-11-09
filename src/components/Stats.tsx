import { useState, type CSSProperties } from 'react'
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

/** Player-related stats can be held back for a big reveal. Flip to false to show everything straight away. */
const CONCEAL_PLAYER_STATS = true

/** What has been revealed this visit (kept across tab switches, reset on reload). */
const revealed = new Set<string>()

function Fact({
  id,
  label,
  value,
  detail,
  hidden,
  onReveal,
  chip,
}: {
  id: string
  label: string
  value: string
  detail: string
  hidden: boolean
  onReveal: (id: string) => void
  chip?: boolean
}) {
  return (
    <div className={hidden ? 'fact concealed' : 'fact'}>
      <dt>{label}</dt>
      {/* while hidden the real answer is never rendered, only a stand-in that gets blurred */}
      <dd className={chip ? 'fact-value chip-value' : 'fact-value'}>{hidden ? '000 pts' : value}</dd>
      <dd className="fact-detail">{hidden ? 'Someone at somewhere' : detail}</dd>
      {hidden && (
        <dd className="reveal-wrap">
          <button type="button" className="reveal-btn" onClick={() => onReveal(id)} aria-label={`Reveal: ${label}`}>
            <span>Tap to reveal</span>
          </button>
        </dd>
      )}
    </div>
  )
}

export function Stats({ data, conceal = false }: { data: LeagueData; conceal?: boolean }) {
  const [, setTick] = useState(0)
  const active = conceal && CONCEAL_PLAYER_STATS
  const isHidden = (id: string) => active && !revealed.has(id)
  const reveal = (id: string) => {
    revealed.add(id)
    setTick((t) => t + 1)
  }
  if (data.completed.length === 0) return <p className="empty">Stats appear after the first race is scored.</p>
  const hl = highlights(data)
  const chipFacts = chipHighlights(data)
  const ps = playerStats(data).sort((a, b) => b.raceWins - a.raceWins || b.avgPerRace - a.avgPerRace)
  const own = ownership(data)
  const n = data.players.length

  // Cheapest/priciest squads give a feel for how people are spending.
  const byValue = [...data.players].sort((a, b) => b.value - a.value)

  // everything that can be hidden, so "Reveal all" knows what is left
  const hideable = [
    ...hl.filter((h) => h.players.length > 0).map((h) => h.id),
    ...chipFacts.filter((f) => f.id !== 'ff-in' && f.players.length > 0).map((f) => f.id),
    'records',
    'squads',
  ]
  const hiddenLeft = active ? hideable.filter((id) => !revealed.has(id)) : []
  const revealAll = () => {
    hideable.forEach((id) => revealed.add(id))
    setTick((t) => t + 1)
  }

  return (
    <>
      {active && hiddenLeft.length > 0 && (
        <div className="reveal-bar">
          <p>The player stats are under wraps. Tap a card to reveal it, or show them all.</p>
          <button type="button" className="reveal-all" onClick={revealAll}>
            Reveal all
          </button>
        </div>
      )}
      <section aria-labelledby="hl-h">
        <div className="section-head">
          <h2 id="hl-h">Season highlights</h2>
          <p className="legend-note">
            After {data.completed.length} of {data.races.length} races
          </p>
        </div>
        <dl className="facts">
          {hl.map((h) => (
            <Fact
              key={h.id}
              id={h.id}
              label={h.label}
              value={h.value}
              detail={h.detail}
              hidden={h.players.length > 0 && isHidden(h.id)}
              onReveal={reveal}
            />
          ))}
        </dl>
      </section>

      {chipFacts.length > 0 && (
        <section aria-labelledby="chip-h">
          <div className="section-head">
            <h2 id="chip-h">Chips</h2>
            <p className="legend-note">
              Limitless and Extra DRS compare the chip score with the best score that weekend by a player who didn’t play
              that chip. Final Fix compares the driver brought in with the one swapped out
            </p>
          </div>
          {(['LL', '3X', 'FF', 'NN'] as const).map((key) => {
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
                    <Fact
                      key={h.id}
                      id={h.id}
                      label={h.label}
                      value={h.value}
                      detail={h.detail}
                      chip
                      hidden={h.id !== 'ff-in' && h.players.length > 0 && isHidden(h.id)}
                      onReveal={reveal}
                    />
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
        <div className={isHidden('records') ? 'table-scroll concealed-table' : 'table-scroll'}>
          {isHidden('records') && (
            <button type="button" className="reveal-btn" onClick={() => reveal('records')} aria-label="Reveal the player records">
              <span>Tap to reveal</span>
            </button>
          )}
          <table className="plain-table records" aria-hidden={isHidden('records') || undefined}>
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
                  {isHidden('records') ? (
                    <>
                      <td className="num">0</td>
                      <td className="num">0</td>
                      <td className="num">000</td>
                      <td className="num">
                        000 <span className="muted-text">Somewhere</span>
                      </td>
                      <td className="num">
                        000 <span className="muted-text">Somewhere</span>
                      </td>
                      <td className="num">0 of 6</td>
                    </>
                  ) : (
                    <>
                      <td className="num">{s.raceWins}</td>
                      <td className="num">{s.racesLed}</td>
                      <td className="num">{Math.round(s.avgPerRace)}</td>
                      <td className="num">
                        {s.bestRace ? fmt(s.bestRace.points) : '–'}{' '}
                        <span className="muted-text">{s.bestRace?.race}</span>
                      </td>
                      <td className="num">
                        {s.worstRace ? fmt(s.worstRace.points) : '–'}{' '}
                        <span className="muted-text">{s.worstRace?.race}</span>
                      </td>
                      <td className="num">{s.chipsUsed} of 6</td>
                    </>
                  )}
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
            {isHidden('squads') ? (
              <p className="note-line concealed-line">
                <button type="button" className="reveal-btn" onClick={() => reveal('squads')} aria-label="Reveal the squad values">
                  <span>Tap to reveal</span>
                </button>
                <span className="blurred" aria-hidden="true">
                  Most valuable squad: <b>Someone</b> £000.0m. Smallest: <b>Someone</b> £000.0m.
                </span>
              </p>
            ) : (
              <p className="note-line">
                Most valuable squad: <b>{byValue[0].name}</b> {money(byValue[0].value)}. Smallest:{' '}
                <b>{byValue[byValue.length - 1].name}</b> {money(byValue[byValue.length - 1].value)}.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
