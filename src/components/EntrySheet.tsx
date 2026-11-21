import { useState } from 'react'
import { db, type Entry, type Meal } from '../db'
import { MEALS, MEAL_LABEL } from '../lib/meals'
import { NumberField, Seg } from './ui'
import Sheet from './Sheet'

type Props = {
  /** Existing entry to edit, or undefined to add a new one. */
  entry?: Entry
  date: string
  meal: Meal
  onClose: () => void
}

const opt = (n: number | '') => (n === '' ? undefined : n)

export default function EntrySheet({ entry, date, meal, onClose }: Props) {
  const [description, setDescription] = useState(entry?.description ?? '')
  const [calories, setCalories] = useState<number | ''>(entry?.calories ?? '')
  const [m, setMeal] = useState<Meal>(entry?.meal ?? meal)
  const [d, setDate] = useState(entry?.date ?? date)
  const [protein, setProtein] = useState<number | ''>(entry?.protein ?? '')
  const [carbs, setCarbs] = useState<number | ''>(entry?.carbs ?? '')
  const [fat, setFat] = useState<number | ''>(entry?.fat ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const valid = description.trim().length > 0 && calories !== '' && calories >= 0 && calories < 10000 && !!d

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
    else await db.entries.add({ ...data, source: 'manual', createdAt: Date.now() })
    onClose()
  }

  async function remove() {
    if (!entry?.id) return
    await db.entries.delete(entry.id)
    onClose()
  }

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
      <label className="field">
        What did you eat?
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. 2 scrambled eggs with cheese and a slice of toast"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          rows={3}
        />
        <span className="hint">Tip: tap the microphone on your keyboard to say it instead of typing.</span>
      </label>

      <NumberField label="Calories" value={calories} onChange={setCalories} suffix="cal" />

      <div className="field">
        <span style={{ fontWeight: 600, fontSize: 15 }}>Meal</span>
        <Seg label="Meal" value={m} onChange={setMeal} options={MEALS.map((x) => ({ value: x, label: MEAL_LABEL[x] }))} />
      </div>

      <label className="field">
        Date
        <input type="date" value={d} onChange={(e) => setDate(e.target.value)} />
      </label>

      <details className="card flat">
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
