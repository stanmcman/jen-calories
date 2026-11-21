import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Entry, type Meal } from '../db'
import { addDays, fmt, parseISO, prettyDate, todayISO } from '../lib/dates'
import { MEALS, MEAL_LABEL, mealForNow } from '../lib/meals'
import Ring from '../components/Ring'
import EntrySheet from '../components/EntrySheet'
import EntryRow from '../components/EntryRow'

type Editing = { entry?: Entry; meal: Meal } | null

export default function DayView({
  date,
  goal,
  onBack,
  onChangeDate,
}: {
  date: string
  goal: number
  /** When shown from History, a back button returns there. */
  onBack?: () => void
  onChangeDate?: (d: string) => void
}) {
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).sortBy('createdAt'), [date]) ?? []
  const [editing, setEditing] = useState<Editing>(null)
  const eaten = entries.reduce((s, e) => s + e.calories, 0)
  const isToday = date === todayISO()
  const d0 = parseISO(date)
  const longDate = d0.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(d0.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })

  return (
    <div className="screen fade-in">
      {onBack && (
        <button className="btn ghost" style={{ alignSelf: 'flex-start', marginLeft: -8 }} onClick={onBack}>
          ‹ History
        </button>
      )}
      <div className="header">
        <div>
          <div className="eyebrow">{longDate}</div>
          <h1>{prettyDate(date)}</h1>
        </div>
        {onChangeDate && (
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn" aria-label="Previous day" onClick={() => onChangeDate(addDays(date, -1))}>
              ‹
            </button>
            <button
              className="icon-btn"
              aria-label="Next day"
              disabled={isToday}
              onClick={() => onChangeDate(addDays(date, 1))}
            >
              ›
            </button>
          </div>
        )}
      </div>

      <section className="card stack" style={{ paddingTop: 22, paddingBottom: 20 }}>
        <Ring eaten={eaten} goal={goal} isToday={isToday} />
        <div className="row between" style={{ padding: '0 8px' }}>
          <div>
            <div className="label">Eaten</div>
            <div className="stat num">{fmt(eaten)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="label">Goal</div>
            <div className="stat num">{fmt(goal)}</div>
          </div>
        </div>
      </section>

      {MEALS.map((meal) => {
        const items = entries.filter((e) => e.meal === meal)
        const total = items.reduce((s, e) => s + e.calories, 0)
        return (
          <section key={meal} className="card meal">
            <div className="row between meal-head">
              <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
                <h3>{MEAL_LABEL[meal]}</h3>
                {total > 0 && <span className="muted small num">{fmt(total)} cal</span>}
              </div>
              <button className="btn ghost small-btn" onClick={() => setEditing({ meal })} aria-label={`Add to ${MEAL_LABEL[meal]}`}>
                + Add
              </button>
            </div>
            {items.length > 0 && (
              <div className="list">
                {items.map((e) => (
                  <EntryRow key={e.id} entry={e} onClick={() => setEditing({ entry: e, meal })} />
                ))}
              </div>
            )}
          </section>
        )
      })}

      {!onBack && (
        <button className="fab" onClick={() => setEditing({ meal: isToday ? mealForNow() : 'snack' })}>
          <span aria-hidden>+</span> Add food
        </button>
      )}

      {editing && (
        <EntrySheet entry={editing.entry} date={date} meal={editing.meal} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
