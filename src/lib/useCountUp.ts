import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Counts from 0 up to `value` once on mount (skipped when `enabled` is false or motion is reduced). */
export function useCountUp(value: number, enabled: boolean, ms = 900, delay = 0): number {
  const [shown, setShown] = useState(enabled && !reduced() ? 0 : value)
  // the latest value, so scores arriving mid-count (or after it) are never left behind
  const latest = useRef(value)
  latest.current = value
  const done = useRef(false)
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
        setShown(Math.round(latest.current * (1 - Math.pow(1 - k, 3))))
        if (k < 1) raf = requestAnimationFrame(tick)
        else done.current = true
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
  useEffect(() => {
    if (done.current) setShown(value)
  }, [value])
  return enabled && !reduced() ? shown : value
}
