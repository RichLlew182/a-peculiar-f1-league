import { useEffect, useRef, type CSSProperties } from 'react'
import { useSeason } from '../lib/SeasonContext'
import { fmt, money, ordinal, raceCode, signedFmt, textOn } from '../lib/format'
import { driverName, TEAM_NAMES } from '../lib/names'
import { chipUseFor, playerProfile, type RaceLine } from '../lib/playerProfile'
import { playerColour } from '../lib/playerColour'
import { unlimitedPlayers } from '../lib/stats'
import { useWidth } from '../lib/useWidth'
import { CHIPS, type Colours, type LeagueData } from '../lib/types'

const swatch = (hex?: string) => (hex ? ({ '--c': hex } as CSSProperties) : undefined)

/** Position after each race. Lower is better, so rank 1 sits at the top. */
function RankChart({ lines, field, width }: { lines: RaceLine[]; field: number; width: number }) {
  const W = Math.max(width, lines.length * 40 + 60)
  const H = 210
  const m = { l: 34, r: 16, t: 14, b: 30 }
  const x = (i: number) => m.l + (lines.length > 1 ? (i * (W - m.l - m.r)) / (lines.length - 1) : (W - m.l - m.r) / 2)
  const y = (rank: number) => m.t + ((rank - 1) / Math.max(1, field - 1)) * (H - m.t - m.b)
  const ticks = [...new Set([1, 3, Math.ceil(field / 2), field])]
  const path = lines.map((l, i) => `${i ? 'L' : 'M'}${x(i)},${y(l.rank)}`).join(' ')
  return (
    <svg width={W} height={H} role="img" aria-label="Position after each race" className="player-chart">
      <rect x={m.l} y={y(1) - 6} width={W - m.l - m.r} height={y(3) - y(1) + 12} className="podium-band" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="chart-label">
            {ordinal(t)}
          </text>
        </g>
      ))}
      <path d={path} className="rank-line" />
      {lines.map((l, i) => (
        <g key={l.race}>
          <circle cx={x(i)} cy={y(l.rank)} r={4} className="rank-dot">
            <title>{`${l.race}: ${ordinal(l.rank)}`}</title>
          </circle>
          <text x={x(i)} y={H - 10} textAnchor="middle" className="chart-label small">
            {raceCode(l.race)}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** Points per race against the league average, with a dot where a chip was played. */
function PointsChart({ lines, colours, width }: { lines: RaceLine[]; colours: Colours; width: number }) {
  const W = Math.max(width, lines.length * 40 + 60)
  const H = 220
  const m = { l: 40, r: 16, t: 18, b: 30 }
  const maxV = Math.max(...lines.map((l) => Math.max(l.points, l.leagueAvg)), 1)
  const top = Math.ceil(maxV / 100) * 100
  const step = (W - m.l - m.r) / lines.length
  const y = (v: number) => m.t + (1 - v / top) * (H - m.t - m.b)
  const avgPath = lines.map((l, i) => `${i ? 'L' : 'M'}${m.l + step * (i + 0.5)},${y(l.leagueAvg)}`).join(' ')
  return (
    <svg width={W} height={H} role="img" aria-label="Points scored at each race" className="player-chart">
      {[0, top / 2, top].map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="chart-label">
            {fmt(t)}
          </text>
        </g>
      ))}
      {lines.map((l, i) => {
        const cx = m.l + step * (i + 0.5)
        const bw = Math.min(22, step - 8)
        const chip = l.chips[0]
        const hex = chip ? colours.chips[chip.chip] : undefined
        return (
          <g key={l.race}>
            <rect x={cx - bw / 2} y={y(l.points)} width={bw} height={y(0) - y(l.points)} rx={0} className="points-bar">
              <title>{`${l.race}: ${fmt(l.points)} pts (league average ${fmt(l.leagueAvg)})${
                l.chips.length ? `, ${l.chips.map((c) => c.chip).join(' + ')} played` : ''
              }`}</title>
            </rect>
            {chip && <circle cx={cx} cy={y(l.points) - 9} r={5} fill={hex ?? 'var(--ink)'} className="chip-dot" />}
            <text x={cx} y={H - 10} textAnchor="middle" className="chart-label small">
              {raceCode(l.race)}
            </text>
          </g>
        )
      })}
      <path d={avgPath} className="avg-line" />
    </svg>
  )
}

/** Fills the available width, and scrolls sideways (starting at the latest race) when the chart needs more room. */
function ChartBox({ children }: { children: (width: number) => React.ReactNode }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [ref, width])
  return (
    <div className="chart-wrap" ref={ref}>
      {children(width)}
    </div>
  )
}

interface TeamRow {
  key: string
  code: string
  name: string
  price: number
  hex?: string
  boosted: boolean
}

function TeamList({ label, rows }: { label: string; rows: TeamRow[] }) {
  if (rows.length === 0) return null
  return (
    <>
      <h4 className="team-sub">{label}</h4>
      <ul className="team-list" aria-label={label}>
        {rows.map((r) => (
          <li key={r.key} style={swatch(r.hex)} className="team-row">
            <span className="team-row-name">
              <b>{r.name}</b> <span className="muted-text">{r.code}</span>
              {r.boosted && <em title="Double points driver">2×</em>}
            </span>
            <span className="team-row-price">{money(r.price)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

export function PlayerPage({ data, name }: { data: LeagueData; name: string }) {
  const { href } = useSeason()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    heading.current?.focus()
  }, [name])

  const prof = playerProfile(data, name)
  if (!prof) {
    return (
      <section>
        <a className="back-link" href={href('standings')}>
          ← Back to standings
        </a>
        <p className="empty">There’s nobody called “{name}” in the league.</p>
      </section>
    )
  }

  const { player: p, lines } = prof
  const started = data.completed.length > 0
  const unlimited = unlimitedPlayers(data).has(p.name)
  const leader = data.players[0]
  const above = data.players[data.players.indexOf(p) - 1]
  const usedCount = CHIPS.filter((c) => p.chips[c.key] || chipUseFor(prof, c.key)).length
  const chipNote = (l: RaceLine | null) =>
    l && l.chips.length ? ` with ${l.chips.map((c) => CHIPS.find((x) => x.key === c.chip)!.name).join(' and ')}` : ''

  const facts: { label: string; value: string; detail: string }[] = [
    {
      label: 'Position',
      value: started ? ordinal(p.rank) : '–',
      detail: !started
        ? 'No races scored yet'
        : p.rank === 1
          ? data.players[1]
            ? `Leading by ${fmt(Math.abs(data.players[1].leaderGap))} over ${data.players[1].name}`
            : 'Leading'
          : above === leader
            ? `${fmt(Math.abs(p.gap))} behind ${leader.name}, the leader`
            : `${fmt(Math.abs(p.gap))} behind ${above?.name ?? 'the player above'}, ${fmt(Math.abs(p.leaderGap))} behind ${leader.name}`,
    },
    { label: 'Points', value: fmt(p.points), detail: started ? `Average ${fmt(Math.round(prof.avgPoints))} per race` : 'No races scored yet' },
    {
      label: 'Budget',
      value: unlimited ? '∞' : money(p.budget),
      detail: unlimited
        ? `Limitless chip this weekend, so no budget limit · Team value ${money(p.value)} · Cap ${money(p.cap)}`
        : `Team value ${money(p.value)} · Cap ${money(p.cap)}`,
    },
  ]
  if (prof.best && prof.worst) {
    facts.push(
      { label: 'Best race', value: `${fmt(prof.best.points)} pts`, detail: `${prof.best.race}${chipNote(prof.best)}` },
      {
        label: 'Worst race',
        value: `${fmt(prof.worst.points)} pts`,
        detail: `${prof.worst.race}${chipNote(prof.worst)}`,
      },
      {
        label: 'Weekend wins (joint included)',
        value: `${prof.wins.length} of ${lines.length}`,
        detail: prof.wins.length ? prof.wins.map((w) => w.race).join(', ') : 'None yet',
      },
      { label: 'Weeks in the lead', value: `${prof.racesLed}`, detail: `${prof.podiums} weeks in the top three` },
    )
  }
  if (prof.bestRank && prof.worstRank) {
    facts.push(
      { label: 'Highest position', value: ordinal(prof.bestRank.rank), detail: `After ${prof.bestRank.race}` },
      { label: 'Lowest position', value: ordinal(prof.worstRank.rank), detail: `After ${prof.worstRank.race}` },
    )
  }
  if (prof.sprintAvg !== null && prof.raceAvg !== null) {
    facts.push({
      label: 'Sprint weekends',
      value: `${fmt(Math.round(prof.sprintAvg))} pts`,
      detail: `Average, against ${fmt(Math.round(prof.raceAvg))} at other weekends`,
    })
  }
  facts.push({
    label: 'Chips used',
    value: `${usedCount} of ${CHIPS.length}`,
    detail: `${CHIPS.length - usedCount} still to play`,
  })

  const constructorRows = p.constructors.map((c) => ({
    key: `c-${c.code}`,
    code: c.code,
    name: TEAM_NAMES[c.code] ?? c.code,
    price: c.price,
    hex: data.colours.teams[c.code],
    boosted: false,
  }))
  const driverRows = p.drivers.map((d) => ({
    key: `d-${d.code}`,
    code: d.code,
    name: driverName(d.code),
    price: d.price,
    hex: data.colours.drivers[d.code],
    boosted: !!d.boosted,
  }))

  return (
    <section aria-labelledby="player-h" className="player-page">
      <a className="back-link" href={href('standings')}>
        ← Back to standings
      </a>
      <header className="player-head" style={{ '--c': playerColour(data.playerNames, p.name) } as CSSProperties}>
        <h2 id="player-h" ref={heading} tabIndex={-1}>
          {p.name}
        </h2>
        {p.teamName && <p className="player-team">{p.teamName}</p>}
      </header>

      <dl className="facts">
        {facts.map((f) => (
          <div key={f.label} className="fact">
            <dt>{f.label}</dt>
            <dd className="fact-value">{f.value}</dd>
            <dd className="fact-detail">{f.detail}</dd>
          </div>
        ))}
      </dl>

      <div className="player-block">
        <h3>Current team</h3>
        <TeamList label="Drivers" rows={driverRows} />
        <TeamList label="Constructors" rows={constructorRows} />
      </div>

      <div className="player-block">
        <h3>Chips</h3>
        <ul className="chip-cards">
          {CHIPS.map((c) => {
            const use = chipUseFor(prof, c.key)
            const used = p.chips[c.key] || !!use
            const hex = data.colours.chips[c.key]
            return (
              <li key={c.key} className="chip-card">
                <span
                  className={used ? 'chip used' : 'chip'}
                  style={hex ? ({ '--chip': hex, '--chip-ink': textOn(hex) } as CSSProperties) : undefined}
                >
                  {c.short}
                </span>
                <span className="chip-card-text">
                  <b>{c.name}</b>
                  <span className="muted-text">
                    {use ? `Played at ${use.race}` : used ? 'Played' : 'Still available'}
                  </span>
                  {use?.out && use.in && (
                    <span className="muted-text">
                      Swapped {driverName(use.out)} for {driverName(use.in)}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {lines.length > 1 && (
        <>
          <div className="player-block">
            <h3>Position after each race</h3>
            <ChartBox>{(w) => <RankChart lines={lines} field={data.players.length} width={w} />}</ChartBox>
            <p className="chart-note">The shaded band is the podium.</p>
          </div>
          <div className="player-block">
            <h3>Points at each race</h3>
            <ChartBox>{(w) => <PointsChart lines={lines} colours={data.colours} width={w} />}</ChartBox>
            <p className="chart-note">
              Bars are this player’s score, the dashed line is the league average, and a dot marks a chip being played.
            </p>
          </div>
        </>
      )}

      <div className="player-block">
        <h3>Race by race</h3>
        <div className="table-scroll">
          <table className="plain-table player-table">
            <caption className="sr-only">{p.name}’s results at each race</caption>
            <thead>
              <tr>
                <th scope="col">Race</th>
                <th scope="col" className="num">
                  Points
                </th>
                <th scope="col" className="num">
                  League average
                </th>
                <th scope="col" className="num">
                  Position
                </th>
                <th scope="col">Chip</th>
              </tr>
            </thead>
            <tbody>
              {[...lines].reverse().map((l) => (
                <tr key={l.race}>
                  <th scope="row">
                    {l.race}
                    {l.sprint && <span className="tag"> Sprint</span>}
                    {l.weekendWinner && <span className="tag purple"> Top score</span>}
                  </th>
                  <td className="num">{fmt(l.points)}</td>
                  <td className="num">
                    {fmt(l.leagueAvg)} <span className="muted-text">({signedFmt(l.points - l.leagueAvg)})</span>
                  </td>
                  <td className="num">
                    {ordinal(l.rank)}
                    {l.move !== 0 && (
                      <span className={l.move > 0 ? 'move up' : 'move down'}>
                        {' '}
                        {l.move > 0 ? '▲' : '▼'}
                        {Math.abs(l.move)}
                      </span>
                    )}
                  </td>
                  <td>{l.chips.map((c) => CHIPS.find((x) => x.key === c.chip)!.short).join(' + ') || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
