import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getKV, type Entry, type Meal } from '../db'
import { MEALS, MEAL_LABEL } from '../lib/meals'
import { fmt } from '../lib/dates'
import { sameFood, suggest, type Suggestion } from '../lib/suggest'
import { useObjectURL } from '../lib/useObjectURL'
import { estimateFromPhoto, estimateFromText, explain, preparePhoto, type FoodEstimate, type FoodItem } from '../lib/ai'
import { NumberField, Seg } from './ui'
import Sheet from './Sheet'
import { CameraIcon, PhotosIcon, SparkleIcon, StarIcon } from './icons'
import { BarcodeScan, FoodSearch, type Picked } from './FoodPick'

type Props = {
  /** Existing entry to edit, or undefined to add a new one. */
  entry?: Entry
  date: string
  meal: Meal
  onClose: () => void
  /** Open straight into photo mode. */
  startWith?: 'describe' | 'photo'
}

type Mode = 'describe' | 'photo' | 'scan' | 'search'
type AIState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string }

const opt = (n: number | '') => (n === '' ? undefined : n)
const num = (n?: number) => (n === undefined ? '' : n)

export default function EntrySheet({ entry, date, meal, onClose, startWith = 'describe' }: Props) {
  const [mode, setMode] = useState<Mode>(startWith)
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

  // Photo + AI
  const [photo, setPhoto] = useState<Blob | undefined>(entry?.photo)
  const [photoB64, setPhotoB64] = useState<string>()
  const [photoNote, setPhotoNote] = useState('')
  const [ai, setAI] = useState<AIState>({ kind: 'idle' })
  const [draft, setDraft] = useState<FoodEstimate | null>(null)
  const photoUrl = useObjectURL(photo)
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const [apiKey, setApiKey] = useState('')
  useEffect(() => {
    getKV<string>('anthropicKey').then((k) => setApiKey(k || ''))
  }, [])
  const aiOn = apiKey !== ''

  const favorites = useLiveQuery(() => db.favorites.orderBy('description').toArray()) ?? []
  const recents = useLiveQuery(() => db.entries.orderBy('createdAt').reverse().limit(500).toArray()) ?? []
  const recipes = useLiveQuery(() => db.recipes.toArray()) ?? []

  // Star: is this food saved as a favorite? `null` = she hasn't touched it, so follow the data.
  const [starTouched, setStarTouched] = useState<boolean | null>(null)
  const isFavInDb = favorites.some((f) => sameFood(f.description, description))
  const starred = starTouched ?? (entry ? isFavInDb : false)

  const suggestions = useMemo(
    () =>
      showSuggest && mode === 'describe' && !draft
        ? suggest(description, favorites, recents.filter((r) => r.id !== entry?.id), 5, recipes)
        : [],
    [description, favorites, recents, recipes, showSuggest, entry?.id, mode, draft],
  )

  const valid = description.trim().length > 0 && calories !== '' && calories >= 0 && calories < 10000 && !!d
  const isNew = !entry

  function fill(s: Suggestion) {
    setDescription(s.description)
    setCalories(s.calories)
    setProtein(num(s.protein))
    setCarbs(num(s.carbs))
    setFat(num(s.fat))
    if (s.protein !== undefined) setMacrosOpen(true)
    setSource(s.recipe ? 'recipe' : s.favorite ? 'favorite' : 'manual')
    setStarTouched(s.favorite ? true : null)
    setShowSuggest(false)
  }

  function applyPicked(p: Picked, from: 'barcode' | 'search') {
    setDraft(null)
    setDescription(p.description)
    setCalories(p.calories)
    setProtein(num(p.protein))
    setCarbs(num(p.carbs))
    setFat(num(p.fat))
    if (p.protein !== undefined) setMacrosOpen(true)
    setSource(from)
    setShowSuggest(false)
    setMode('describe')
  }

  function applyEstimate(r: FoodEstimate, from: 'ai-text' | 'ai-photo') {
    setDraft(r)
    setDescription(r.description)
    setCalories(r.calories)
    setProtein(r.protein_g)
    setCarbs(r.carbs_g)
    setFat(r.fat_g)
    setSource(from)
    setShowSuggest(false)
  }

  async function onPickPhoto(file?: File) {
    if (!file) return
    setAI({ kind: 'idle' })
    setDraft(null)
    try {
      const { base64, thumb } = await preparePhoto(file)
      setPhoto(thumb)
      setPhotoB64(base64)
    } catch {
      setAI({ kind: 'error', message: "Couldn't open that photo. Try a different one." })
    }
  }

  async function estimate() {
    if (!aiOn) return
    setAI({ kind: 'loading' })
    try {
      if (mode === 'photo' && photoB64) applyEstimate(await estimateFromPhoto(apiKey, photoB64, photoNote), 'ai-photo')
      else applyEstimate(await estimateFromText(apiKey, description), 'ai-text')
      setAI({ kind: 'idle' })
    } catch (e) {
      setAI({ kind: 'error', message: explain(e).message })
    }
  }

  /** Editing an item's calories in the breakdown updates the total. */
  function editItem(i: number, cal: number | '') {
    if (!draft) return
    const items = draft.items.map((it, j) => (j === i ? { ...it, calories: cal === '' ? 0 : cal } : it))
    setDraft({ ...draft, items })
    setCalories(items.reduce((s, it) => s + it.calories, 0))
  }
  function removeItem(i: number) {
    if (!draft) return
    const items = draft.items.filter((_, j) => j !== i)
    setDraft({ ...draft, items })
    setCalories(items.reduce((s, it) => s + it.calories, 0))
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
      photo,
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

  const showFavPicker = isNew && mode === 'describe' && description.trim() === '' && favorites.length > 0
  const loading = ai.kind === 'loading'

  return (
    <Sheet
      title={entry ? 'Edit food' : 'Add food'}
      onClose={onClose}
      footer={
        <button className="btn block" disabled={!valid || loading} onClick={save}>
          {entry ? 'Save changes' : 'Add to log'}
        </button>
      }
    >
      {isNew && (
        <Seg
          label="How to add"
          value={mode}
          onChange={(v) => {
            setMode(v)
            setAI({ kind: 'idle' })
          }}
          options={[
            { value: 'describe', label: 'Describe' },
            { value: 'photo', label: 'Photo' },
            { value: 'scan', label: 'Scan' },
            { value: 'search', label: 'Search' },
          ]}
        />
      )}

      {mode === 'scan' && <BarcodeScan onUse={(p) => applyPicked(p, 'barcode')} />}
      {mode === 'search' && <FoodSearch onUse={(p) => applyPicked(p, 'search')} />}

      {/* ---------- Photo ---------- */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          onPickPhoto(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onPickPhoto(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {mode === 'photo' && !photoUrl && (
        <div className="photo-pick">
          <button type="button" className="photo-btn" onClick={() => cameraInput.current?.click()}>
            <CameraIcon />
            Take a photo
          </button>
          <button type="button" className="photo-btn" onClick={() => libraryInput.current?.click()}>
            <PhotosIcon />
            Choose from library
          </button>
        </div>
      )}
      {photoUrl && (mode === 'photo' || mode === 'describe' || !isNew) && (
        <div className="photo-wrap">
          <img className="entry-photo" src={photoUrl} alt="Photo of this meal" />
          {loading && <div className="photo-scan" aria-hidden />}
          {isNew && mode === 'photo' && !loading && (
            <button type="button" className="photo-retake" onClick={() => libraryInput.current?.click()}>
              Change photo
            </button>
          )}
        </div>
      )}
      {isNew && mode === 'photo' && photoUrl && !draft && (
        <>
          <label className="field">
            Anything to add? <span className="hint">Optional — e.g. “I ate about half” or “with ranch dressing”</span>
            <input
              type="text"
              value={photoNote}
              onChange={(e) => setPhotoNote(e.target.value)}
              autoCapitalize="sentences"
              enterKeyHint="done"
            />
          </label>
          <AIButton on={aiOn} loading={loading} onClick={estimate} label="Estimate calories from photo" loadingLabel="Looking at your photo…" />
        </>
      )}

      {/* ---------- Description ---------- */}
      {(mode === 'describe' || !isNew || (mode === 'photo' && (photoUrl || draft))) && (
        <div className="field">
          <div className="row between">
            <label htmlFor="desc" style={{ fontWeight: 600, fontSize: 15 }}>
              {mode === 'photo' && isNew ? 'Description' : 'What did you eat?'}
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
            placeholder={
              mode === 'photo' ? 'Filled in by the estimate, or type your own' : 'e.g. 2 scrambled eggs with cheese and a slice of toast'
            }
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck
            rows={3}
          />
          {suggestions.length > 0 && (
            <div className="suggest" role="listbox" aria-label="Suggestions">
              {suggestions.map((s) => (
                <button key={s.key} type="button" role="option" className="suggest-item" onClick={() => fill(s)}>
                  {s.favorite ? (
                    <StarIcon filled small />
                  ) : s.recipe ? (
                    <span className="recipe-tag" aria-label="Recipe">R</span>
                  ) : (
                    <span className="recent-dot" aria-hidden />
                  )}
                  <span className="grow">{s.description}</span>
                  <span className="num muted">{fmt(s.calories)}</span>
                </button>
              ))}
            </div>
          )}
          {mode === 'describe' && (
            <span className="hint">Tip: tap the microphone on your keyboard to say it instead of typing.</span>
          )}
        </div>
      )}

      {mode === 'describe' && isNew && !draft && (
        <AIButton
          on={aiOn}
          loading={loading}
          disabled={description.trim().length < 3}
          onClick={estimate}
          label="Estimate calories"
          loadingLabel="Estimating…"
        />
      )}

      {ai.kind === 'error' && (
        <div className="card warn flat small" role="alert">
          {ai.message}
        </div>
      )}

      {draft && (
        <section className="card accent stack draft" aria-live="polite">
          <div className="row between">
            <div className="row" style={{ gap: 8 }}>
              <SparkleIcon />
              <h3>AI estimate</h3>
            </div>
            <span className={`pill ${draft.confidence === 'high' ? 'good' : draft.confidence === 'low' ? 'warn' : ''}`}>
              {draft.confidence === 'high' ? 'High' : draft.confidence === 'medium' ? 'Medium' : 'Low'} confidence
            </span>
          </div>
          {draft.note && <p className="small muted">{draft.note}</p>}
          {draft.items.length > 1 && (
            <div className="items">
              {draft.items.map((it: FoodItem, i) => (
                <div key={i} className="item-row">
                  <div className="grow">
                    <div style={{ fontWeight: 650 }}>{it.name}</div>
                    <div className="muted small">{it.amount}</div>
                  </div>
                  <input
                    className="item-cal"
                    type="number"
                    inputMode="numeric"
                    aria-label={`Calories for ${it.name}`}
                    value={it.calories}
                    onChange={(e) => editItem(i, e.target.value === '' ? '' : Number(e.target.value))}
                  />
                  <button type="button" className="item-x" aria-label={`Remove ${it.name}`} onClick={() => removeItem(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="note">This is an estimate. Change anything below before saving.</p>
        </section>
      )}

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

      {(mode === 'describe' || !isNew || (mode === 'photo' && (photoUrl || draft))) && (
        <>
          <NumberField label="Calories" value={calories} onChange={setCalories} suffix="cal" />

          <div className="field">
            <span style={{ fontWeight: 600, fontSize: 15 }}>Meal</span>
            <Seg label="Meal" value={m} onChange={setMeal} options={MEALS.map((x) => ({ value: x, label: MEAL_LABEL[x] }))} />
          </div>

          <label className="field">
            Date
            <input type="date" value={d} onChange={(e) => setDate(e.target.value)} />
          </label>

          <details className="card flat" open={macrosOpen || !!draft} onToggle={(e) => setMacrosOpen(e.currentTarget.open)}>
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
        </>
      )}

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

function AIButton({
  on,
  loading,
  disabled,
  onClick,
  label,
  loadingLabel,
}: {
  on: boolean
  loading: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  loadingLabel: string
}) {
  if (!on)
    return (
      <div className="ai-off">
        <button type="button" className="btn secondary block" disabled>
          <SparkleIcon /> {label}
        </button>
        <p className="note">AI estimates are off. To turn them on, add an API key in More → AI estimates.</p>
      </div>
    )
  return (
    <button type="button" className={`btn block ai-btn${loading ? ' loading' : ''}`} disabled={disabled || loading} onClick={onClick}>
      <SparkleIcon /> {loading ? loadingLabel : label}
    </button>
  )
}
