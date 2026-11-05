import { useState, type CSSProperties } from 'react'
import { textOn } from '../lib/format'
import { driverName } from '../lib/names'
import { buildRecap, recapSentences } from '../lib/recap'
import { CHIPS, type LeagueData, type Race } from '../lib/types'

const KEY = 'f1-fantasy:recap-dismissed:v1'

const readDismissed = (): string | null => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

const WEEK_KEY = 'f1-fantasy:race-week-dismissed:v1'

const readWeekDismissed = (): string | null => {
  try {
    return localStorage.getItem(WEEK_KEY)
  } catch {
    return null
  }
}

/** Shown while a race weekend is under way but no points are in yet (set from the Status tab). */
function RaceWeekBanner({ data, next }: { data: LeagueData; next: Race }) {
  const [dismissed, setDismissed] = useState<string | null>(readWeekDismissed)
  if (dismissed === next.name) return null
  const latest = data.completed[data.completed.length - 1]
  const played = CHIPS.map((c) => ({
    chip: c.key,
    uses: data.chipUses.filter((u) => u.chip === c.key && u.race.trim().toLowerCase() === next.name.toLowerCase()),
  })).filter((g) => g.uses.length > 0)

  const close = () => {
    setDismissed(next.name)
    try {
      localStorage.setItem(WEEK_KEY, next.name)
    } catch {
      /* storage unavailable: it will simply show again next visit */
    }
  }

  return (
    <aside className="banner" aria-labelledby="banner-h">
      <button type="button" className="banner-close" onClick={close} aria-label={`Dismiss the ${next.name} race week notice`}>
        <span aria-hidden="true">×</span>
      </button>
      <h2 id="banner-h" className="banner-title">
        {next.name}
        {next.sprint ? ' sprint weekend' : ''} <span className="muted-text">· race week</span>
      </h2>
      <p className="banner-text">
        Teams are in for {next.name}, but no points have been scored yet.
        {latest ? ` The standings below are still as they were after ${latest.name}.` : ''}
      </p>
      {data.statusNote && <p className="banner-text">{data.statusNote}</p>}
      {played.length > 0 && (
        <ul className="banner-chips" aria-label="Chips being played">
          {played.map((g) => {
            const def = CHIPS.find((c) => c.key === g.chip)!
            const hex = data.colours.chips[g.chip]
            return (
              <li key={g.chip}>
                <span
                  className="chip used"
                  title={def.name}
                  style={hex ? ({ '--chip': hex, '--chip-ink': textOn(hex) } as CSSProperties) : undefined}
                >
                  {def.short}
                </span>
                <span>
                  {g.uses
                    .map((u) =>
                      u.out && u.in ? `${u.player} (${driverName(u.out)} for ${driverName(u.in)})` : u.player,
                    )
                    .join(', ')}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {latest && (
        <a className="banner-link" href="#races">
          See the {latest.name} recap
        </a>
      )}
    </aside>
  )
}

/** A short summary of the latest race, shown on landing until dismissed. Returns for each new race. */
export function RecapBanner({ data }: { data: LeagueData }) {
  // The Status tab says a weekend is under way; ignored once every race has points.
  const next = data.races.find((r) => !r.complete)
  if (data.raceWeek && next) return <RaceWeekBanner data={data} next={next} />
  return <LatestBanner data={data} />
}

function LatestBanner({ data }: { data: LeagueData }) {
  const latest = data.completed[data.completed.length - 1]
  const [dismissed, setDismissed] = useState<string | null>(readDismissed)
  if (!latest || dismissed === latest.name) return null

  const r = buildRecap(data, latest)
  const { win, lead, leadChanged, podium, final } = recapSentences(r)
  const news = [...(leadChanged && !final ? [{ kind: 'lead' as const, text: lead }] : []), ...(final ? [] : podium)]

  const close = () => {
    setDismissed(latest.name)
    try {
      localStorage.setItem(KEY, latest.name)
    } catch {
      /* storage unavailable: it will simply show again next visit */
    }
  }

  return (
    <aside className="banner" aria-labelledby="banner-h">
      <button type="button" className="banner-close" onClick={close} aria-label={`Dismiss the ${latest.name} recap`}>
        <span aria-hidden="true">×</span>
      </button>
      <h2 id="banner-h" className="banner-title">
        {final ? 'Season complete' : latest.name}
        {!final && latest.sprint ? ' sprint weekend' : ''}{' '}
        <span className="muted-text">· {final ? `after ${latest.name}` : 'latest race'}</span>
      </h2>
      {final && <p className="banner-big">{final}</p>}
      {news.length > 0 && (
        <ul className="banner-news">
          {news.map((n) => (
            <li key={n.text} className={`news-${n.kind}`}>
              <span className="news-icon" aria-hidden="true">
                {n.kind === 'in' ? '▲' : n.kind === 'out' ? '▼' : '★'}
              </span>
              {n.text}
            </li>
          ))}
        </ul>
      )}
      <p className="banner-text">{leadChanged || final ? win : `${win} ${lead}`}</p>
      {r.chips.length > 0 && (
        <ul className="banner-chips" aria-label="Chips played">
          {r.chips.map((g) => {
            const def = CHIPS.find((c) => c.key === g.chip)!
            const hex = data.colours.chips[g.chip]
            return (
              <li key={g.chip}>
                <span
                  className="chip used"
                  title={def.name}
                  style={hex ? ({ '--chip': hex, '--chip-ink': textOn(hex) } as CSSProperties) : undefined}
                >
                  {def.short}
                </span>
                <span>
                  {g.uses
                    .map((u) =>
                      u.out && u.in ? `${u.player} (${driverName(u.out)} for ${driverName(u.in)})` : u.player,
                    )
                    .join(', ')}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <a className="banner-link" href="#races">
        See the full recap
      </a>
    </aside>
  )
}
