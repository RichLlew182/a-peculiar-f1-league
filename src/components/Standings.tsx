import { useEffect, useRef, type CSSProperties } from 'react'
import { hotStreaks, unlimitedPlayers } from '../lib/stats'
import { Flame, Trophy } from './icons'
import { RecapBanner } from './RecapBanner'
import { useCountUp } from '../lib/useCountUp'
import { playerColour } from '../lib/playerColour'
import { useSeason } from '../lib/SeasonContext'
import { fmt, money, ordinal, signedFmt, textOn } from '../lib/format'
import { CHIPS, type Colours, type LeagueData, type Player, type Race } from '../lib/types'

/** Clicking anywhere on a row or card opens the player's page (the name stays the real, keyboard-friendly link). */
const openPlayer = (href: string) => (e: React.MouseEvent) => {
  if ((e.target as HTMLElement).closest('a')) return
  if (window.getSelection()?.toString()) return // the user is selecting text
  window.location.hash = href.slice(1)
}

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
            title={`${c.name}: ${isUsed ? 'used' : 'available'}`}
          >
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

/** Shown for players who have beaten the league average at several races in a row. */
function Hot({ n }: { n: number }) {
  return (
    <span className="hot" title={`Above the league average for the last ${n} races`}>
      <Flame />
      On fire
    </span>
  )
}

/** Points, counting up the first time the podium appears. */
function PodiumPoints({ value, animate, delay }: { value: number; animate: boolean; delay: number }) {
  const shown = useCountUp(value, animate, 1000, delay)
  return (
    <>
      {fmt(shown)} <span>pts</span>
    </>
  )
}

let podiumPlayed = false

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
function Podium({
  players,
  names,
  unlimited,
  colours,
  latest,
  finished,
  hot,
}: {
  players: Player[]
  names: string[]
  unlimited: Set<string>
  colours: Colours
  latest?: Race
  finished: boolean
  hot: Map<string, number>
}) {
  const { href } = useSeason()
  const playerHref = (name: string) => href(`player/${encodeURIComponent(name)}`)
  const animate = useRef(!podiumPlayed).current
  useEffect(() => {
    podiumPlayed = true
  }, [])
  const topGain = latest ? Math.max(...Object.values(latest.gains)) : undefined
  return (
    <ol className={animate ? 'podium enter' : 'podium'} aria-label="Top three">
      {players.map((p, i) => {
        const move = latest?.moves[p.name] ?? 0
        const gained = latest?.gains[p.name]
        const lead = p.rank === 1
        const chaser = lead ? players.find((q) => q.points < p.points) : undefined
        return (
          <li
            key={p.name}
            className={`podium-slot place-${i + 1}`}
            style={{ '--c': playerColour(names, p.name) } as CSSProperties}
          >
            <div className="podium-card clickable" onClick={openPlayer(playerHref(p.name))}>
              <div className="podium-top">
                <span className="podium-place" aria-hidden="true">
                  {ordinal(p.rank)}
                </span>
                {finished && p.rank === 1 && (
                  <span className="podium-champ">
                    <Trophy />
                    Champion
                  </span>
                )}
                {gained !== undefined && (
                  <span
                    className={gained === topGain ? 'podium-gained top-score' : 'podium-gained'}
                    title={gained === topGain ? `Top score of the weekend at ${latest?.name}` : `Points scored at ${latest?.name}`}
                  >
                    {signedFmt(gained)} <span className="muted-text">{latest?.name}</span>
                  </span>
                )}
                <Move move={move} />
              </div>
              <h3 className="podium-name">
                <span className="sr-only">{ordinal(p.rank)}: </span>
                <a className="player-link" href={playerHref(p.name)}>
                  {p.name}
                </a>
                {hot.has(p.name) && <Hot n={hot.get(p.name) as number} />}
              </h3>
              {p.teamName && <p className="podium-team">{p.teamName}</p>}
              <p className="podium-points">
                <PodiumPoints value={p.points} animate={animate} delay={[400, 200, 0][i] ?? 0} />
              </p>
              {lead && (
                <p className="podium-gaps">
                  {chaser ? (
                    <span title={`${fmt(p.points - chaser.points)} points ahead of ${chaser.name}`}>
                      Lead over {chaser.name} <b>{fmt(p.points - chaser.points)}</b>
                    </span>
                  ) : (
                    <span>Level at the top</span>
                  )}
                </p>
              )}
              {!lead && (
                <p className="podium-gaps">
                  <span title={`${fmt(Math.abs(p.gap))} points behind ${players[i - 1]?.name ?? 'the player above'}`}>
                    Gap to next <b>{fmt(Math.abs(p.gap))}</b>
                  </span>
                  <span title={`${fmt(Math.abs(p.leaderGap))} points behind ${players[0]?.name ?? 'the leader'}`}>
                    Gap to leader <b>{fmt(Math.abs(p.leaderGap))}</b>
                  </span>
                </p>
              )}
              <p className="podium-gaps podium-budget">
                <span>
                  Budget{' '}
                  <b>
                    {unlimited.has(p.name) ? (
                      <span title="Limitless chip this weekend, so no budget limit">
                        ∞<span className="sr-only"> unlimited (Limitless chip this weekend)</span>
                      </span>
                    ) : (
                      money(p.budget)
                    )}
                  </b>
                </span>
              </p>
              <Chips player={p} colours={colours} />
            </div>
            <div className="podium-step" aria-hidden="true">
              <span className="podium-rank">
                {p.rank}
                <span className="podium-suffix">{ordinal(p.rank).slice(String(p.rank).length)}</span>
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function Standings({ data }: { data: LeagueData }) {
  const { href } = useSeason()
  const playerHref = (name: string) => href(`player/${encodeURIComponent(name)}`)
  const latest = data.completed[data.completed.length - 1]
  const raceLabel = latest ? latest.name : 'last race'
  // Before the first race everyone is level: no podium, players in name order, no ranks or gaps to show
  const started = data.completed.length > 0
  const players = started ? data.players : [...data.players].sort((a, b) => a.name.localeCompare(b.name))
  const rest = started ? players.slice(3) : players
  const finished = data.completed.length > 0 && data.completed.length === data.races.length
  const hot = hotStreaks(data)
  const unlimited = unlimitedPlayers(data) // a Limitless chip lifts the budget limit
  const topGain = latest ? Math.max(...Object.values(latest.gains)) : undefined

  return (
    <section aria-labelledby="standings-h">
      <div className="section-head">
        <h2 id="standings-h">{finished ? 'Final standings' : `Standings${latest ? ` after ${latest.name}` : ''}`}</h2>
        <p className="legend-note">
          Chips: <span className="chip used">filled</span> used, <span className="chip">outlined</span> still available
        </p>
      </div>

      {started && <RecapBanner data={data} />}

      {started && (
        <Podium
          players={data.players.slice(0, 3)}
          names={data.playerNames}
          unlimited={unlimited}
          colours={data.colours}
          latest={latest}
          finished={finished}
          hot={hot}
        />
      )}

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
            <span role="columnheader" className="num" title="Budget for the next race">
              Budget
            </span>
            <span role="columnheader">Chips</span>
          </div>

          {rest.map((p) => {
            const gained = latest?.gains[p.name]
            const move = latest?.moves[p.name] ?? 0
            return (
              <div
                key={p.name}
                className={started && p.rank === 1 ? 'tower-row clickable leader' : 'tower-row clickable'}
                role="row"
                onClick={openPlayer(playerHref(p.name))}
              >
                <span className="pos" role="cell" style={{ '--c': playerColour(data.playerNames, p.name) } as CSSProperties}>
                  {started ? p.rank : '–'}
                  {started && (
                    <span className="pos-suffix" aria-hidden="true">
                      {ordinal(p.rank).slice(String(p.rank).length)}
                    </span>
                  )}
                </span>
                <span className="movecell" role="cell">
                  <Move move={move} />
                </span>
                <span className="who" role="cell">
                  <strong>
                    <a className="player-link" href={playerHref(p.name)}>
                      {p.name}
                    </a>
                    {hot.has(p.name) && <Hot n={hot.get(p.name) as number} />}
                  </strong>
                  {p.teamName && <span className="team-name">{p.teamName}</span>}
                  <span className="who-sub">
                    {gained !== undefined && (
                      <span
                        className={gained === topGain ? 'top-score' : undefined}
                        title={gained === topGain ? `Top score of the weekend at ${raceLabel}` : `Points scored at ${raceLabel}`}
                      >
                        {signedFmt(gained)} <span className="muted-text">{raceLabel}</span>
                      </span>
                    )}
                  </span>
                </span>
                <span className="points num" role="cell">
                  {fmt(p.points)}
                </span>
                <span className="gap-cell num" role="cell">
                  <span
                    className="gap g-next"
                    data-label="Next"
                    title={`${fmt(Math.abs(p.gap))} points behind ${data.players[data.players.indexOf(p) - 1]?.name ?? 'the player above'}`}
                  >
                    {!started ? <span className="muted-text">–</span> : p.rank === 1 ? <span className="muted-text">Leader</span> : fmt(Math.abs(p.gap))}
                  </span>
                  <span
                    className="gap g-lead"
                    data-label="Leader"
                    title={`${fmt(Math.abs(p.leaderGap))} points behind ${data.players[0]?.name ?? 'the leader'}`}
                  >
                    {!started || p.rank === 1 ? <span className="muted-text">–</span> : fmt(Math.abs(p.leaderGap))}
                  </span>
                </span>
                <span className="budget-cell num" role="cell">
                  {unlimited.has(p.name) ? (
                    <span className="budget-inf" title="Limitless chip this weekend, so no budget limit">
                      ∞<span className="sr-only"> unlimited (Limitless chip this weekend)</span>
                    </span>
                  ) : (
                    money(p.budget)
                  )}
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
