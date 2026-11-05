import { createContext, useContext } from 'react'
import { CURRENT_SEASON } from './seasons'
import { hashFor } from './route'

export interface SeasonCtx {
  id: string
  /** hash link to a page of this season */
  href: (rest: string) => string
}

export const SeasonContext = createContext<SeasonCtx>({ id: CURRENT_SEASON, href: (rest) => hashFor(CURRENT_SEASON, rest) })
export const useSeason = () => useContext(SeasonContext)
