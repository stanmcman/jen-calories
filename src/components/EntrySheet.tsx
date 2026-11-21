import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Entry, type Meal } from '../db'
import { MEALS, MEAL_LABEL } from '../lib/meals'
import { fmt } from '../lib/dates'
import { sameFood, suggest, type Suggestion } from '../lib/suggest'
import { useObjectURL } from '../lib/useObjectURL'
import { NumberField, Seg } from './ui'
import Sheet from './Sheet'
import { StarIcon } from './icons'

type Props = {
  /** Existing entry to edit, or undefined to add a new one. */
  entry?: Entry
  date: string
  meal: Meal
  onClose: () => void
}

const opt = (n: number | '') => (n === '' ? undefined : n)
const num = (n?: number) => (n === undefined ? '' : n)

export default function EntrySheet({ entry, date, meal, onClose }: Props) {
  const [description, setDescription] = useState(entry?.description ?? '')
  const [calories, setCalories] = useState<number | ''>(entry?.calories ?? '')
  const [m, setMeal] = useState<Meal>(entry?.meal ?? meal)
  const [d, setDate] = useState(entry?.date ?? date)
  const [protein, setProtein] = useState<number | ''>(num(entry?.protein))
  const [carbs, setCarbs] = useState<number | ''>(num(entry?.carbs))
  const [fat, setFat] = useState<number | ''>(num(entry?.fat))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [source, setSource] = useState<Entry['source']>(entry?.source ?? 'manual')
  const [showSuggest, setShowSuggest] = useState(true)
  const [macrosOpen, setMacrosOpen] = useState(entry?.protein !== undefined)
  const photoUrl = useObjectURL(entry?.photo)

  const favorites = useLiveQuery(() => db.favorites.orderBy('description').toArray()) ?? []
  const recents = useLiveQuery(() => db.entries.orderBy('createdAt').reverse().limit(500).toArray()) ?? []

  // Star: is this food saved as a favorite? `null` = she hasn't touched it, so follow the data.
  const [starTouched, setStarTouched] = useState<boolean | null>(null)
  const isFavInDb = favorites.some((f) => sameFood(f.description, description))
  const starred = starTouched ?? (entry ? isFavInDb : false)

  const suggestions = useMemo(
    () => (showSuggest ? suggest(description, favorites, recents.filter((r) => r.id !== entry?.id)) : []),
    [description, favorites, recents, showSuggest, entry?.id],
  )

  const valid = description.trim().length > 0 && calories !== '' && calories >= 0 && calories < 10000 && !!d

  function fill(s: Suggestion) {
    setDescription(s.description)
    setCalories(s.calories)
    setProtein(num(s.protein))
    setCarbs(num(s.carbs))
    setFat(num(s.fat))
    if (s.protein !== undefined) setMacrosOpen(true)
    setSource(s.favorite ? 'favorite' : 'manual')
    setStarTouched(s.favorite ? true : null)
    setShowSuggest(false)
  }

  async function save() {
    if (!valid) return
    const data = {
      description: description.trim(),
      calories: Math.round(calories as number),
      meal: m,
      date: d,
      protein: opt(protein),
      carbs: opt(carbs),
      fat: opt(fat),
    }
    if (entry?.id) await db.entries.update(entry.id, data)
    else await db.entries.add({ ...data, source, createdAt: Date.now() })

    // Keep favorites in step with the star.
    const existing = favorites.find((f) => sameFood(f.description, data.description))
    const fav = { description: data.description, calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat }
    if (starred && existing) await db.favorites.update(existing.id!, fav)
    else if (starred) await db.favorites.add({ ...fav, meal: m, createdAt: Date.now() })
    else if (starTouched === false && existing) await db.favorites.delete(existing.id!)
    onClose()
  }

  async function remove() {
    if (!entry?.id) return
    await db.entries.delete(entry.id)
    onClose()
  }

  const showFavPicker = !entry && description.trim() === '' && favorites.length > 0

  return (
    <Sheet
      title={entry ? 'Edit food' : 'Add food'}
      onClose={onClose}
      footer={
        <button className="btn block" disabled={!valid} onClick={save}>
          {entry ? 'Save changes' : 'Add to log'}
        </button>
      }
    >
      {photoUrl && <img className="entry-photo" src={photoUrl} alt="Photo of this meal" />}

      <div className="field">
        <div className="row between">
          <label htmlFor="desc" style={{ fontWeight: 600, fontSize: 15 }}>
            What did you eat?
          </label>
          <button
            type="button"
            className={`star-toggle${starred ? ' on' : ''}`}
            aria-pressed={starred}
            onClick={() => setStarTouched(!starred)}
          >
            <StarIcon filled={starred} /> {starred ? 'Favorite' : 'Add to favorites'}
          </button>
        </div>
        <textarea
          id="desc"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            setShowSuggest(true)
          }}
          placeholder="e.g. 2 scrambled eggs with cheese and a slice of toast"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          rows={3}
        />
        {suggestions.length > 0 && (
          <div className="suggest" role="listbox" aria-label="Suggestions">
            {suggestions.map((s) => (
              <button key={s.key} type="button" role="option" className="suggest-item" onClick={() => fill(s)}>
                {s.favorite ? <StarIcon filled small /> : <span className="recent-dot" aria-hidden />}
                <span className="grow">{s.description}</span>
                <span className="num muted">{fmt(s.calories)}</span>
              </button>
            ))}
          </div>
        )}
        <span className="hint">Tip: tap the microphone on your keyboard to say it instead of typing.</span>
      </div>

      {showFavPicker && (
        <div className="field">
          <span style={{ fontWeight: 600, fontSize: 15 }}>Or pick a favorite</span>
          <div className="chips">
            {favorites.slice(0, 12).map((f) => (
              <button
                key={f.id}
                type="button"
                className="chip"
                onClick={() => fill({ ...f, key: String(f.id), favorite: true })}
              >
                {f.description} <span className="muted num">{fmt(f.calories)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <NumberField label="Calories" value={calories} onChange={setCalories} suffix="cal" />

      <div className="field">
        <span style={{ fontWeight: 600, fontSize: 15 }}>Meal</span>
        <Seg label="Meal" value={m} onChange={setMeal} options={MEALS.map((x) => ({ value: x, label: MEAL_LABEL[x] }))} />
      </div>

      <label className="field">
        Date
        <input type="date" value={d} onChange={(e) => setDate(e.target.value)} />
      </label>

      <details className="card flat" open={macrosOpen} onToggle={(e) => setMacrosOpen(e.currentTarget.open)}>
        <summary style={{ fontWeight: 650 }}>Protein, carbs &amp; fat (optional)</summary>
        <div className="row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
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
      </details>

      {entry &&
        (confirmDelete ? (
          <div className="card warn flat stack">
            <p>Delete “{entry.description}”?</p>
            <div className="row">
              <button className="btn secondary grow" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button className="btn grow" style={{ background: 'var(--danger)' }} onClick={remove}>
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button className="btn danger block" onClick={() => setConfirmDelete(true)}>
            Delete this entry
          </button>
        ))}
    </Sheet>
  )
}
