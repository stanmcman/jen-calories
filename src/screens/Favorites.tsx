import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Favorite, type Meal } from '../db'
import { fmt, todayISO } from '../lib/dates'
import { MEALS, MEAL_LABEL, mealForNow } from '../lib/meals'
import Sheet from '../components/Sheet'
import { NumberField, Seg } from '../components/ui'
import { StarIcon } from '../components/icons'

export default function Favorites({ onBack }: { onBack: () => void }) {
  const favorites = useLiveQuery(() => db.favorites.toArray()) ?? []
  const [editing, setEditing] = useState<Favorite | 'new' | null>(null)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const q = query.toLowerCase().trim()
  const shown = favorites
    .filter((f) => !q || f.description.toLowerCase().includes(q))
    .sort((a, b) => a.description.localeCompare(b.description))

  function logged(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  return (
    <div className="screen fade-in">
      <button className="btn ghost" style={{ alignSelf: 'flex-start', marginLeft: -8 }} onClick={onBack}>
        ‹ More
      </button>
      <div className="header">
        <div>
          <div className="eyebrow">The usual</div>
          <h1>Favorites</h1>
        </div>
        <button className="btn secondary" style={{ minHeight: 44 }} onClick={() => setEditing('new')}>
          + New
        </button>
      </div>

      {favorites.length > 5 && (
        <input type="search" placeholder="Search favorites" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}

      {favorites.length === 0 ? (
        <section className="card flat stack">
          <p>No favorites yet.</p>
          <p className="muted small">
            When you add or edit a food, tap <strong>Add to favorites</strong>. Favorites pop up as you type, so the
            usual things take one tap.
          </p>
        </section>
      ) : (
        <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <div className="list">
            {shown.map((f) => (
              <button key={f.id} className="list-item" onClick={() => setEditing(f)}>
                <StarIcon filled small />
                <div className="grow">
                  <div style={{ fontWeight: 650 }}>{f.description}</div>
                  <div className="muted small">Usually {MEAL_LABEL[f.meal].toLowerCase()}</div>
                </div>
                <span className="num entry-cal">{fmt(f.calories)}</span>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {editing && (
        <FavoriteSheet
          fav={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onLogged={logged}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function FavoriteSheet({
  fav,
  onClose,
  onLogged,
}: {
  fav?: Favorite
  onClose: () => void
  onLogged: (msg: string) => void
}) {
  const [description, setDescription] = useState(fav?.description ?? '')
  const [calories, setCalories] = useState<number | ''>(fav?.calories ?? '')
  const [meal, setMeal] = useState<Meal>(fav?.meal ?? mealForNow())
  const [protein, setProtein] = useState<number | ''>(fav?.protein ?? '')
  const [carbs, setCarbs] = useState<number | ''>(fav?.carbs ?? '')
  const [fat, setFat] = useState<number | ''>(fav?.fat ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [logMeal, setLogMeal] = useState<Meal>(mealForNow())

  const valid = description.trim() !== '' && calories !== '' && calories >= 0
  const o = (n: number | '') => (n === '' ? undefined : n)
  const data = () => ({
    description: description.trim(),
    calories: Math.round(calories as number),
    meal,
    protein: o(protein),
    carbs: o(carbs),
    fat: o(fat),
  })

  async function save() {
    if (!valid) return
    if (fav?.id) await db.favorites.update(fav.id, data())
    else await db.favorites.add({ ...data(), createdAt: Date.now() })
    onClose()
  }

  async function logToday() {
    if (!valid) return
    const d = data()
    await db.entries.add({
      date: todayISO(),
      meal: logMeal,
      description: d.description,
      calories: d.calories,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
      source: 'favorite',
      createdAt: Date.now(),
    })
    if (fav?.id) await db.favorites.update(fav.id, d)
    onClose()
    onLogged(`Added to today's ${MEAL_LABEL[logMeal].toLowerCase()}`)
  }

  return (
    <Sheet
      title={fav ? 'Favorite' : 'New favorite'}
      onClose={onClose}
      footer={
        <button className={`btn block${fav ? ' secondary' : ''}`} disabled={!valid} onClick={save}>
          {fav ? 'Save changes' : 'Save favorite'}
        </button>
      }
    >
      {fav && (
        <section className="card accent stack">
          <h3>Log it today</h3>
          <Seg label="Meal" value={logMeal} onChange={setLogMeal} options={MEALS.map((x) => ({ value: x, label: MEAL_LABEL[x] }))} />
          <button className="btn block" disabled={!valid} onClick={logToday}>
            Add to today · {calories === '' ? '–' : fmt(calories)} cal
          </button>
        </section>
      )}
      <label className="field">
        Food
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} autoCapitalize="sentences" />
      </label>
      <NumberField label="Calories" value={calories} onChange={setCalories} suffix="cal" />
      <div className="field">
        <span style={{ fontWeight: 600, fontSize: 15 }}>Usual meal</span>
        <Seg label="Usual meal" value={meal} onChange={setMeal} options={MEALS.map((x) => ({ value: x, label: MEAL_LABEL[x] }))} />
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <NumberField label="Protein" value={protein} onChange={setProtein} suffix="g" />
        </div>
        <div className="grow">
          <NumberField label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
        </div>
        <div className="grow">
          <NumberField label="Fat" value={fat} onChange={setFat} suffix="g" />
        </div>
      </div>
      {fav &&
        (confirmDelete ? (
          <div className="card warn flat stack">
            <p>Remove “{fav.description}” from favorites? Past log entries stay as they are.</p>
            <div className="row">
              <button className="btn secondary grow" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button
                className="btn grow"
                style={{ background: 'var(--danger)' }}
                onClick={async () => {
                  await db.favorites.delete(fav.id!)
                  onClose()
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button className="btn danger block" onClick={() => setConfirmDelete(true)}>
            Remove from favorites
          </button>
        ))}
    </Sheet>
  )
}
