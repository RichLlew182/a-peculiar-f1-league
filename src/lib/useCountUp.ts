import { useEffect, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Counts from 0 up to `value` once on mount (skipped when `enabled` is false or motion is reduced). */
export function useCountUp(value: number, enabled: boolean, ms = 900, delay = 0): number {
  const [shown, setShown] = useState(enabled && !reduced() ? 0 : value)
  useEffect(() => {
    if (!enabled || reduced()) {
      setShown(value)
      return
    }
    let raf = 0
    let start = 0
    const t = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now
        const k = Math.min(1, (now - start) / ms)
        setShown(Math.round(value * (1 - Math.pow(1 - k, 3))))
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => {
      window.clearTimeout(t)
      cancelAnimationFrame(raf)
    }
    // animate only once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return enabled && !reduced() ? shown : value
}
