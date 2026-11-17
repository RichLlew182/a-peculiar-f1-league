import { inject, pageview } from '@vercel/analytics'
import type { Route } from './route'

/** Vercel Web Analytics (cookie-free). Tabs use #links, so page views are sent by hand whenever the route changes. */
export function startAnalytics() {
  inject({ disableAutoTrack: true })
}

export function trackRoute(r: Route) {
  const rest = r.player ? `player/${r.player}` : r.tab
  pageview({ route: `/${r.season}/${r.player ? 'player' : r.tab}`, path: `/${r.season}/${rest}` })
}
