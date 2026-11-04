import type { CSSProperties } from 'react'
import { RecapBanner } from './RecapBanner'
import { fmt, money, ordinal, signedFmt, textOn } from '../lib/format'
import { CHIPS, type Colours, type LeagueData, type Player, type Race } from '../lib/types'

const swatch = (hex?: string) => (hex ? ({ '--c': hex } as CSSProperties) : undefined)

function Chips({ player, colours }: { player: Player; colours: Colours }) {
  const used = CHIPS.filter((c) => player.chips[c.key]).length
  return (
    <ul className="chips" aria-label={`Chips used: ${used} of ${CHIPS.length}`}>
      {CHIPS.map((c) => {
        const isUsed = player.chips[c.key]
        const hex = colours.chips[c.key]
        return (
          <li
            key={c.key}
            className={isUsed ? 'chip used' : 'chip'}
            style={hex ? ({ '--chip': hex, '--chip-ink': textOn(hex) } as CSSProperties) : undefined}
            title={`${c.name}: ${isUsed ? 'used' : 'available'}`}>
            {c.short}
            <span className="sr-only">
              {' '}
              {c.name} {isUsed ? 'used' : 'available'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Team({ player, colours }: { player: Player; colours: Colours }) {
  return (
    <div className="team">
      <ul className="picks" aria-label="Constructors">
        {player.constructors.map((c) => (
          <li key={c.code} className="pick constructor" style={swatch(colours.teams[c.code])}>
            <b>{c.code}</b>
          </li>
        ))}
      </ul>
      <ul className="picks" aria-label="Drivers">
        {player.drivers.map((d) => (
          <li key={d.code} className={d.boosted ? 'pick boosted' : 'pick'} style={swatch(colours.drivers[d.code])}>
            <b>{d.code}</b>
            {d.boosted && <em title="Double points driver">2×</em>}
          </li>
        ))}
      </ul>
      <p className="team-meta">
        Value {money(player.value)} · Cap {money(player.cap)} · Budget {money(player.budget)}
      </p>
    </div>
  )
}

/** Places gained or lost at the last race, as a badge that is easy to spot down the table. */
function Move({ move }: { move: number }) {
  if (!move) {
    return (
      <span className="badge flat">
        <span aria-hidden="true">–</span>
        <span className="sr-only">No change</span>
      </span>
    )
  }
  const up = move > 0
  const n = Math.abs(move)
  return (
    <span className={up ? 'badge up' : 'badge down'}>
      <span className="badge-arrow" aria-hidden="true">
        {up ? '▲' : '▼'}
      </span>
      <b aria-hidden="true">{n}</b>
      <span className="sr-only">
        {n} {n === 1 ? 'place' : 'places'} {up ? 'up' : 'down'}
      </span>
    </span>
  )
}

/** The top three laid out like a podium: 2nd on the left, 1st in the middle, 3rd on the right. */
function Podium({ players, colours, latest }: { players: Player[]; colours: Colours; latest?: Race }) {
  return (
    <ol className="podium" aria-label="Top three">
      {players.map((p, i) => {
        const move = latest?.moves[p.name] ?? 0
        const gained = latest?.gains[p.name]
        const lead = p.rank === 1
        return (
          <li key={p.name} className={`podium-slot place-${i + 1}`}>
            <div className="podium-card">
              <div className="podium-top">
                <span className="podium-place" aria-hidden="true">
                  {ordinal(p.rank)}
                </span>
                {gained !== undefined && (
                  <span className="podium-gained" title={`Points scored at ${latest?.name}`}>
                    {signedFmt(gained)} <span className="muted-text">{latest?.name}</span>
                  </span>
                )}
                <Move move={move} />
              </div>
              <h3 className="podium-name">
                <span className="sr-only">{ordinal(p.rank)}: </span>
                {p.name}
              </h3>
              {p.teamName && <p className="podium-team">{p.teamName}</p>}
              <p className="podium-points">
                {fmt(p.points)} <span>pts</span>
              </p>
              {!lead && (
                <p className="podium-gaps">
                  <span>
                    Gap to next <b>{fmt(Math.abs(p.gap))}</b>
                  </span>
                  <span>
                    Gap to leader <b>{fmt(Math.abs(p.leaderGap))}</b>
                  </span>
                </p>
              )}
              <Team player={p} colours={colours} />
              <Chips player={p} colours={colours} />
            </div>
            <div className="podium-step" aria-hidden="true">
              {p.rank}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function Standings({ data }: { data: LeagueData }) {
  const latest = data.completed[data.completed.length - 1]
  const raceLabel = latest ? latest.name : 'last race'
  const rest = data.players.slice(3)

  return (
    <section aria-labelledby="standings-h">
      <div className="section-head">
        <h2 id="standings-h">Standings{latest ? ` after ${latest.name}` : ''}</h2>
        <p className="legend-note">
          Chips: <span className="chip used">filled</span> used, <span className="chip">outlined</span> still available
        </p>
      </div>

      <RecapBanner data={data} />

      <Podium players={data.players.slice(0, 3)} colours={data.colours} latest={latest} />

      {rest.length > 0 && (
      <div className="tower" role="table" aria-label="Rest of the league standings">
        <div className="tower-head" role="row">
          <span role="columnheader">Pos</span>
          <span role="columnheader" title="Places gained or lost at the last race">
            Move
          </span>
          <span role="columnheader">Player</span>
          <span role="columnheader" className="num">
            Points
          </span>
          <span role="columnheader" className="num" title="Points behind the player above / behind the leader">
            Gap to next / leader
          </span>
          <span role="columnheader">Team</span>
          <span role="columnheader">Chips</span>
        </div>

        {rest.map((p) => {
          const gained = latest?.gains[p.name]
          const move = latest?.moves[p.name] ?? 0
          return (
            <div key={p.name} className={p.rank === 1 ? 'tower-row leader' : 'tower-row'} role="row">
              <span className="pos" role="cell">
                {p.rank}
              </span>
              <span className="movecell" role="cell">
                <Move move={move} />
              </span>
              <span className="who" role="cell">
                <strong>{p.name}</strong>
                {p.teamName && <span className="team-name">{p.teamName}</span>}
                <span className="who-sub">
                  {gained !== undefined && (
                    <span title={`Points scored at ${raceLabel}`}>
                      {signedFmt(gained)} <span className="muted-text">{raceLabel}</span>
                    </span>
                  )}
                </span>
              </span>
              <span className="points num" role="cell">
                {fmt(p.points)}
              </span>
              <span className="gap-cell num" role="cell">
                <span className="gap g-next" data-label="Next">
                  {p.rank === 1 ? <span className="muted-text">Leader</span> : fmt(Math.abs(p.gap))}
                </span>
                <span className="gap g-lead" data-label="Leader">
                  {p.rank === 1 ? <span className="muted-text">–</span> : fmt(Math.abs(p.leaderGap))}
                </span>
              </span>
              <span className="team-cell" role="cell">
                <Team player={p} colours={data.colours} />
              </span>
              <span className="chips-cell" role="cell">
                <Chips player={p} colours={data.colours} />
              </span>
            </div>
          )
        })}
      </div>
      )}
    </section>
  )
}
