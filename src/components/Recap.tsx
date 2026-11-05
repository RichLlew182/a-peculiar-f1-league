import { useState, type CSSProperties } from 'react'
import { fmt, ordinal, textOn } from '../lib/format'
import { driverName } from '../lib/names'
import { buildRecap, recapSentences, type Mover, type Scorer } from '../lib/recap'
import { CHIPS, type LeagueData } from '../lib/types'

function Scorers({ rows, top }: { rows: Scorer[]; top?: number }) {
  return (
    <ol className="recap-rows">
      {rows.map((s) => (
        <li key={s.name}>
          <span className="recap-name">{s.name}</span>
          <b className={s.points === top ? 'recap-num top-score' : 'recap-num'}>{fmt(s.points)}</b>
          {s.vsAvg !== null && (
            <span className="recap-sub" title="Compared with their average at the other races">
              {s.vsAvg === 0
                ? 'on their average'
                : `${fmt(Math.abs(s.vsAvg))} ${s.vsAvg > 0 ? 'above' : 'below'} average`}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

function Movers({ rows, up }: { rows: Mover[]; up: boolean }) {
  return (
    <ul className="recap-rows">
      {rows.map((m) => (
        <li key={m.name}>
          <span className="recap-name">{m.name}</span>
          <span className={up ? 'badge up' : 'badge down'}>
            <span className="badge-arrow" aria-hidden="true">
              {up ? '▲' : '▼'}
            </span>
            <b aria-hidden="true">{Math.abs(m.from - m.to)}</b>
            <span className="sr-only">
              {Math.abs(m.from - m.to)} {Math.abs(m.from - m.to) === 1 ? 'place' : 'places'} {up ? 'up' : 'down'}
            </span>
          </span>
          <span className="recap-sub">
            {ordinal(m.from)} to {ordinal(m.to)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function Recap({ data }: { data: LeagueData }) {
  const [picked, setPicked] = useState<string | null>(null)
  if (data.completed.length === 0) return null
  const latest = data.completed[data.completed.length - 1]
  const race = data.completed.find((r) => r.name === picked) ?? latest
  const r = buildRecap(data, race)
  const isLatest = race.name === latest.name

  const { win: winLine, avg: avgLine, lead: leadLine, podium, final } = recapSentences(r)

  return (
    <section aria-labelledby="recap-h" className="recap">
      <div className="section-head">
        <h2 id="recap-h">Weekend recap</h2>
        <label className="recap-pick">
          <span className="muted-text">Race</span>
          <select value={race.name} onChange={(e) => setPicked(e.target.value === latest.name ? null : e.target.value)}>
            {[...data.completed].reverse().map((x) => (
              <option key={x.name} value={x.name}>
                R{x.round} {x.name}
                {x.sprint ? ' (sprint)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="recap-headline">
        <b>
          {race.name}
          {race.sprint ? ' sprint weekend' : ''}
        </b>
        {isLatest ? ' · latest race. ' : '. '}
        {final ? <b>Season complete. {final} </b> : null}
        {winLine} {avgLine} {leadLine} {podium.map((x) => x.text).join(' ')}
      </p>

      <div className="recap-grid">
        <div className="recap-block">
          <h3>Best weekends</h3>
          <Scorers rows={r.best} top={r.topPoints} />
        </div>
        <div className="recap-block">
          <h3>Toughest weekends</h3>
          <Scorers rows={r.worst} />
        </div>
        <div className="recap-block">
          <h3>Moved up</h3>
          {r.climbers.length ? (
            <Movers rows={r.climbers} up />
          ) : (
            <p className="recap-none">{race.round === 1 ? 'First race of the season.' : 'Nobody moved up.'}</p>
          )}
        </div>
        <div className="recap-block">
          <h3>Moved down</h3>
          {r.fallers.length ? (
            <Movers rows={r.fallers} up={false} />
          ) : (
            <p className="recap-none">{race.round === 1 ? 'First race of the season.' : 'Nobody moved down.'}</p>
          )}
        </div>
      </div>

      <div className="recap-block recap-chips">
        <h3>Chips played</h3>
        {r.chips.length === 0 ? (
          <p className="recap-none">No chips were played this weekend.</p>
        ) : (
          <ul className="recap-rows">
            {r.chips.map((g) => {
              const def = CHIPS.find((c) => c.key === g.chip)!
              const hex = data.colours.chips[g.chip]
              return (
                <li key={g.chip} className="recap-chip-row">
                  <span
                    className="chip used"
                    title={def.name}
                    style={
                      hex
                        ? ({
                            '--chip': hex,
                            '--chip-ink': textOn(hex),
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    {def.short}
                  </span>
                  <span className="recap-chip-text">
                    <b>{def.name}</b>
                    <span className="recap-uses">
                      {g.uses.map((u) => (
                        <span key={u.player} className="recap-use">
                          {u.player}
                          {u.out && u.in ? (
                            <span className="recap-sub">
                              {' '}
                              swapped {driverName(u.out)} for {driverName(u.in)}
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="recap-note">
        “Above/below average” compares a score with the player’s own average at the other races.
      </p>
    </section>
  )
}
