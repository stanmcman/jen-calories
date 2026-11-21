export function StarIcon({ filled, small }: { filled?: boolean; small?: boolean }) {
  const s = small ? 16 : 20
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden style={{ flex: 'none' }}>
      <path
        d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9L3.4 9.5l6-.8z"
        fill={filled ? 'var(--accent)' : 'none'}
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function CameraIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden {...line}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.6" />
    </svg>
  )
}

export function PhotosIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden {...line}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M20.5 15.5l-4.5-4.5-8.5 8.5" />
    </svg>
  )
}

export function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ flex: 'none' }}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" opacity="0.7" />
    </svg>
  )
}
