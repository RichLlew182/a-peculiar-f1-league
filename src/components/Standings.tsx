import type { CSSProperties } from 'react'
import { fmt, money, signedFmt, textOn } from '../lib/format'
import { CHIPS, type Colours, type LeagueData, type Player } from '../lib/types'

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

function Move({ move }: { move: number }) {
  if (!move) return null
  const up = move > 0
  return (
    <span className={up ? 'move up' : 'move down'}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      {Math.abs(move)}
      <span className="sr-only">{up ? ' places up' : ' places down'}</span>
    </span>
  )
}

export function Standings({ data }: { data: LeagueData }) {
  const latest = data.completed[data.completed.length - 1]
  const raceLabel = latest ? latest.name : 'last race'

  return (
    <section aria-labelledby="standings-h">
      <div className="section-head">
        <h2 id="standings-h">Standings{latest ? ` after ${latest.name}` : ''}</h2>
        <p className="legend-note">
          Chips: <span className="chip used">filled</span> used, <span className="chip">outlined</span> still available
        </p>
      </div>

      <div className="tower" role="table" aria-label="League standings">
        <div className="tower-head" role="row">
          <span role="columnheader">Pos</span>
          <span role="columnheader">Player</span>
          <span role="columnheader" className="num">
            Points
          </span>
          <span role="columnheader" className="num">
            Gap to next
          </span>
          <span role="columnheader" className="num">
            Gap to leader
          </span>
          <span role="columnheader">Chips</span>
          <span role="columnheader">Team</span>
        </div>

        {data.players.map((p) => {
          const gained = latest?.gains[p.name]
          const move = latest?.moves[p.name] ?? 0
          return (
            <div key={p.name} className={p.rank === 1 ? 'tower-row leader' : 'tower-row'} role="row">
              <span className="pos" role="cell">
                {p.rank}
              </span>
              <span className="who" role="cell">
                <strong>{p.name}</strong>
                {p.teamName && <span className="team-name">{p.teamName}</span>}
                <span className="who-sub">
                  <Move move={move} />
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
              <span className="gap g-next num" role="cell" data-label="Gap to next">
                {p.rank === 1 ? <span className="muted-text">Leader</span> : signedFmt(p.gap)}
              </span>
              <span className="gap g-lead num" role="cell" data-label="Gap to leader">
                {p.rank === 1 ? <span className="muted-text">–</span> : signedFmt(p.leaderGap)}
              </span>
              <span className="chips-cell" role="cell">
                <Chips player={p} colours={data.colours} />
              </span>
              <span className="team-cell" role="cell">
                <Team player={p} colours={data.colours} />
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
