import { useState, type CSSProperties } from 'react'
import { useSeason } from '../lib/SeasonContext'
import { scopedKey } from '../lib/route'
import { textOn } from '../lib/format'
import { driverName } from '../lib/names'
import { buildRecap, recapSentences } from '../lib/recap'
import { CHIPS, type LeagueData } from '../lib/types'

const KEY = 'f1-fantasy:recap-dismissed:v1'

const readDismissed = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** A short summary of the latest race, shown on landing until dismissed. Returns for each new race. */
export function RecapBanner({ data }: { data: LeagueData }) {
  const { id, href } = useSeason()
  const key = scopedKey(KEY, id)
  const latest = data.completed[data.completed.length - 1]
  const [dismissed, setDismissed] = useState<string | null>(() => readDismissed(key))
  if (!latest || dismissed === latest.name) return null

  const r = buildRecap(data, latest)
  const { win, lead, leadChanged, podium, final } = recapSentences(r)
  const news = [...(leadChanged && !final ? [{ kind: 'lead' as const, text: lead }] : []), ...(final ? [] : podium)]

  const close = () => {
    setDismissed(latest.name)
    try {
      localStorage.setItem(key, latest.name)
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
      <a className="banner-link" href={href('races')}>
        See the full recap
      </a>
    </aside>
  )
}
