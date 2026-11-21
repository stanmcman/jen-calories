export function todayISO(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISO(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number) {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return todayISO(d)
}

export function prettyDate(s: string) {
  const t = todayISO()
  if (s === t) return 'Today'
  if (s === addDays(t, -1)) return 'Yesterday'
  return parseISO(s).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export const fmt = (n: number) => Math.round(n).toLocaleString()
