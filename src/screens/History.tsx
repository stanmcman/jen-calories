import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { addDays, fmt, parseISO, todayISO } from '../lib/dates'
import { goalForDate, type GoalPoint } from '../lib/goals'

/** Sunday that starts the week containing `date`. */
function weekStart(date: string) {
  return addDays(date, -parseISO(date).getDay())
}

/** "Yogurt, Coffee, Sandwich +2 more" */
function preview(list: string[]) {
  const shown = list.slice(0, 3).map((x) => (x.length > 28 ? x.slice(0, 27).trimEnd() + '…' : x))
  return shown.join(', ') + (list.length > 3 ? ` +${list.length - 3} more` : '')
}

const short = (d: string) => parseISO(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function History({
  goalHistory,
  fallbackGoal,
  onOpenDay,
}: {
  goalHistory?: GoalPoint[]
  fallbackGoal: number
  onOpenDay: (date: string) => void
}) {
  const entries = useLiveQuery(() => db.entries.toArray()) ?? []
  const today = todayISO()
  const [week, setWeek] = useState(() => weekStart(today))

  const { totals, foods, photos } = useMemo(() => {
    const totals = new Map<string, number>()
    const foods = new Map<string, string[]>()
    const photos = new Map<string, number>()
    const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt)
    for (const e of sorted) {
      totals.set(e.date, (totals.get(e.date) ?? 0) + e.calories)
      foods.set(e.date, [...(foods.get(e.date) ?? []), e.description])
      if (e.photo) photos.set(e.date, (photos.get(e.date) ?? 0) + 1)
    }
    return { totals, foods, photos }
  }, [entries])

  const goalOn = (d: string) => goalForDate(goalHistory, d, fallbackGoal)

  // This week's numbers
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const logged = days.filter((d) => (totals.get(d) ?? 0) > 0)
  const avg = logged.length ? logged.reduce((s, d) => s + (totals.get(d) ?? 0), 0) / logged.length : 0
  const onTarget = logged.filter((d) => (totals.get(d) ?? 0) <= goalOn(d)).length
  const maxBar = Math.max(...days.map((d) => Math.max(totals.get(d) ?? 0, goalOn(d))), 1)

  // Every logged day, newest first, grouped by month
  const allDays = [...totals.keys()].filter((d) => (totals.get(d) ?? 0) > 0).sort().reverse()
  const months = new Map<string, string[]>()
  for (const d of allDays) {
    const key = parseISO(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    months.set(key, [...(months.get(key) ?? []), d])
  }

  return (
    <div className="screen fade-in">
      <div className="header">
        <div>
          <div className="eyebrow">Looking back</div>
          <h1>History</h1>
        </div>
      </div>

      <section className="card stack">
        <div className="row between">
          <button className="icon-btn" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}>
            ‹
          </button>
          <div style={{ textAlign: 'center' }}>
            <div className="label">{week === weekStart(today) ? 'This week' : 'Week of'}</div>
            <h3>
              {short(week)} – {short(addDays(week, 6))}
            </h3>
          </div>
          <button
            className="icon-btn"
            aria-label="Next week"
            disabled={week >= weekStart(today)}
            onClick={() => setWeek(addDays(week, 7))}
          >
            ›
          </button>
        </div>

        <div className="bars" role="img" aria-label="Calories each day this week compared with your goal">
          {days.map((d) => {
            const t = totals.get(d) ?? 0
            const g = goalOn(d)
            const future = d > today
            return (
              <button key={d} className="bar-col" disabled={future} onClick={() => onOpenDay(d)}>
                <div className="bar-track">
                  <div className="bar-goal" style={{ bottom: `${(g / maxBar) * 100}%` }} />
                  <div
                    className={`bar-fill${t > g ? ' over' : ''}`}
                    style={{ height: `${(t / maxBar) * 100}%` }}
                  />
                </div>
                <span className={`bar-label${d === today ? ' today' : ''}`}>
                  {parseISO(d).toLocaleDateString(undefined, { weekday: 'narrow' })}
                </span>
              </button>
            )
          })}
        </div>

        <div className="row" style={{ gap: 0 }}>
          <div className="grow">
            <div className="label">Daily average</div>
            <div className="stat num">{logged.length ? fmt(avg) : '—'}</div>
          </div>
          <div className="grow" style={{ textAlign: 'right' }}>
            <div className="label">On target</div>
            <div className="stat num">
              {onTarget} <span className="muted small">of {logged.length} logged</span>
            </div>
          </div>
        </div>
        <p className="note">“On target” means at or under your goal that day. The line on each bar is the goal.</p>
      </section>

      {allDays.length === 0 && (
        <section className="card flat muted small">Days you log food will show up here.</section>
      )}

      {[...months.entries()].map(([month, ds]) => (
        <section key={month} className="stack" style={{ gap: 8 }}>
          <h3 style={{ padding: '0 4px' }}>{month}</h3>
          <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <div className="list">
              {ds.map((d) => {
                const t = totals.get(d) ?? 0
                const g = goalOn(d)
                const over = t - g
                return (
                  <button key={d} className="list-item" onClick={() => onOpenDay(d)}>
                    <div className="grow">
                      <div style={{ fontWeight: 700 }}>
                        {parseISO(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="muted small num">
                        {fmt(t)} of {fmt(g)} cal
                        {photos.get(d) ? ` · ${photos.get(d)} photo${photos.get(d) === 1 ? '' : 's'}` : ''}
                      </div>
                      <div className="day-foods">{preview(foods.get(d) ?? [])}</div>
                    </div>
                    {over > 0 ? (
                      <span className="pill warn num">+{fmt(over)} over</span>
                    ) : (
                      <span className="pill good">On target</span>
                    )}
                    <span className="chev">›</span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
