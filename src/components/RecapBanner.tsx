import { useState, type CSSProperties } from 'react'
import { textOn } from '../lib/format'
import { driverName } from '../lib/names'
import { buildRecap, recapSentences } from '../lib/recap'
import { CHIPS, type LeagueData } from '../lib/types'

const KEY = 'f1-fantasy:recap-dismissed:v1'

const readDismissed = (): string | null => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** A short summary of the latest race, shown on landing until dismissed. Returns for each new race. */
export function RecapBanner({ data }: { data: LeagueData }) {
  const latest = data.completed[data.completed.length - 1]
  const [dismissed, setDismissed] = useState<string | null>(readDismissed)
  if (!latest || dismissed === latest.name) return null

  const r = buildRecap(data, latest)
  const { win, lead } = recapSentences(r)

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
        {latest.name}
        {latest.sprint ? ' sprint weekend' : ''} <span className="muted-text">· latest race</span>
      </h2>
      <p className="banner-text">
        {win} {lead}
      </p>
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
