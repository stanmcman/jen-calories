import { useId } from 'react'
import { fmt } from '../lib/dates'

/** Progress ring: calories eaten vs. goal, painted like a watercolor brush stroke. */
export default function Ring({
  eaten,
  goal,
  size = 236,
  isToday = true,
}: {
  eaten: number
  goal: number
  size?: number
  isToday?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const stroke = 20
  const r = (size - stroke - 12) / 2
  const c = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(eaten / goal, 1) : 0
  const over = eaten > goal
  const remaining = goal - eaten
  const mid = size / 2
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${fmt(eaten)} of ${fmt(goal)} calories`}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            {over ? (
              <>
                <stop offset="0" style={{ stopColor: 'var(--warn)' }} stopOpacity={0.7} />
                <stop offset="1" style={{ stopColor: 'var(--warn)' }} />
              </>
            ) : (
              <>
                <stop offset="0" style={{ stopColor: 'var(--ring-1)' }} />
                <stop offset="0.5" style={{ stopColor: 'var(--ring-2)' }} />
                <stop offset="1" style={{ stopColor: 'var(--ring-3)' }} />
              </>
            )}
          </linearGradient>
          {/* Rough, bleeding edges like pigment on paper */}
          <filter id={`p${id}`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" />
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>
        <g filter={`url(#p${id})`}>
          <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke + 6} />
          {pct > 0 && (
            <circle
              cx={mid}
              cy={mid}
              r={r}
              fill="none"
              stroke={`url(#g${id})`}
              strokeOpacity={0.9}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              transform={`rotate(-90 ${mid} ${mid})`}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          )}
        </g>
      </svg>
      <div
        style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}
      >
        <span className="big-number">{fmt(Math.abs(remaining))}</span>
        <span style={{ fontFamily: 'var(--font-hand)', fontSize: 24, color: 'var(--muted)', lineHeight: 1.1 }}>
          {over ? 'over goal' : isToday ? 'left today' : 'under goal'}
        </span>
      </div>
    </div>
  )
}
