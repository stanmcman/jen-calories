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
