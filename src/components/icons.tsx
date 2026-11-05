import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': true,
  focusable: false,
  ...p,
})

export const Flame = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12.5 2c.4 3-1.2 4.6-2.7 6.3C8.3 10 7 11.6 7 14.2 7 17.4 9.2 20 12 20s5-2.5 5-5.6c0-1.8-.8-3.1-1.6-4.2-.3 1.1-1 1.9-1.9 2.2.5-3.4-.3-6.6-1-8.4ZM12 22c-3.9 0-7-3.1-7-7.8 0-3.2 1.7-5.1 3.2-6.8C9.6 5.8 11 4.5 10.6 2c4.1.8 7.9 4.2 6.9 9.6 1.4 1.2 2.5 2.9 2.5 4.6 0 3.3-3.1 5.8-8 5.8Z" />
  </svg>
)

export const Trophy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 3h10v2h3v3c0 2.2-1.7 4-3.9 4.2A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1a5 5 0 0 1-3.1-2.7C5.7 12 4 10.2 4 8V5h3V3Zm0 4H6v1c0 1 .6 1.8 1.4 2.2A6 6 0 0 1 7 8V7Zm10 0v1c0 .8-.1 1.5-.4 2.2C17.4 9.8 18 9 18 8V7h-1ZM9 5v3.5a3 3 0 1 0 6 0V5H9Z" />
  </svg>
)
