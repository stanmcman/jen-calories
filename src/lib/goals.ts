import { getKV, setKV } from '../db'

/** The daily goal that applied from `from` (YYYY-MM-DD) onward. */
export interface GoalPoint {
  from: string
  goal: number
}

/** Goal in effect on a given date. Past days keep the goal they had at the time. */
export function goalForDate(history: GoalPoint[] | undefined, date: string, fallback: number) {
  if (!history?.length) return fallback
  let g: number | undefined
  for (const p of history) if (p.from <= date) g = p.goal
  return g ?? history[0].goal
}

export async function recordGoal(date: string, goal: number) {
  const hist = ((await getKV<GoalPoint[]>('goalHistory')) ?? []).filter((p) => p.from !== date)
  hist.push({ from: date, goal })
  hist.sort((a, b) => a.from.localeCompare(b.from))
  await setKV('goalHistory', hist)
}
