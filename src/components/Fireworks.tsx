import { useEffect, useRef } from 'react'

const COLOURS = ['#d9b44a', '#f4d77a', '#e10600', '#ff9a1f', '#4a9bff', '#2fd29a', '#ff7ac8']
const DURATION = 6500

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  colour: string
  size: number
}
interface Rocket {
  x: number
  y: number
  vy: number
  target: number
  colour: string
}

/** A short burst of fireworks over its parent (which must be positioned). Skipped when motion is reduced. */
export function Fireworks({ on }: { on: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!on || !canvas || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const rockets: Rocket[] = []
    const sparks: Spark[] = []
    const start = performance.now()
    let last = start
    let nextLaunch = 0
    let raf = 0

    const launch = () => {
      rockets.push({
        x: w * (0.1 + Math.random() * 0.8),
        y: h,
        vy: -(h * (0.9 + Math.random() * 0.4)),
        target: h * (0.12 + Math.random() * 0.4),
        colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
      })
    }
    const explode = (r: Rocket) => {
      const n = 46 + Math.floor(Math.random() * 30)
      const second = COLOURS[Math.floor(Math.random() * COLOURS.length)]
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + Math.random() * 0.2
        const sp = (0.35 + Math.random() * 0.65) * Math.min(w, 700) * 0.42
        sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.9 + Math.random() * 0.7, colour: k % 3 ? r.colour : second, size: 1.6 + Math.random() * 1.6 })
      }
    }

    const frame = (now: number) => {
      const t = now - start
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, w, h)
      if (t < DURATION - 1800 && now >= nextLaunch) {
        launch()
        if (Math.random() < 0.5) launch()
        nextLaunch = now + 260 + Math.random() * 380
      }
      for (let k = rockets.length - 1; k >= 0; k--) {
        const r = rockets[k]
        r.y += r.vy * dt
        ctx.fillStyle = r.colour
        ctx.fillRect(r.x - 1, r.y, 2, 9)
        if (r.y <= r.target) {
          explode(r)
          rockets.splice(k, 1)
        }
      }
      for (let k = sparks.length - 1; k >= 0; k--) {
        const s = sparks[k]
        s.life += dt
        if (s.life >= s.max) {
          sparks.splice(k, 1)
          continue
        }
        s.vx *= 0.985
        s.vy = s.vy * 0.985 + 190 * dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        ctx.globalAlpha = 1 - s.life / s.max
        ctx.fillStyle = s.colour
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (t < DURATION || sparks.length || rockets.length) raf = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, w, h)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ctx.clearRect(0, 0, w, h)
    }
  }, [on])

  return <canvas ref={ref} className="fireworks" aria-hidden="true" />
}
