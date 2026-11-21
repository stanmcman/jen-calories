import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getKV, type Ingredient, type Meal, type Recipe } from '../db'
import { fmt, todayISO } from '../lib/dates'
import { MEALS, MEAL_LABEL, mealForNow } from '../lib/meals'
import { estimateRecipe, explain } from '../lib/ai'
import Sheet from '../components/Sheet'
import { NumberField, Seg } from '../components/ui'
import { SparkleIcon } from '../components/icons'

export const perServing = (r: Pick<Recipe, 'totalCalories' | 'servings'>) => Math.round(r.totalCalories / Math.max(r.servings, 1))

export default function Recipes({ onBack }: { onBack: () => void }) {
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray()) ?? []
  const [open, setOpen] = useState<Recipe | 'new' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  return (
    <div className="screen fade-in">
      <button className="btn ghost" style={{ alignSelf: 'flex-start', marginLeft: -8 }} onClick={onBack}>
        ‹ More
      </button>
      <div className="header">
        <div>
          <div className="eyebrow">Home cooking</div>
          <h1>Recipes</h1>
        </div>
        <button className="btn secondary" style={{ minHeight: 44 }} onClick={() => setOpen('new')}>
          + New
        </button>
      </div>

      {recipes.length === 0 ? (
        <section className="card flat stack">
          <p>No recipes yet.</p>
          <p className="muted small">
            Add a recipe you make often, with its ingredients and how many servings it makes. You'll get calories per
            serving, and logging a serving takes one tap. Saved recipes also pop up when you type in Add food.
          </p>
          <button className="btn" onClick={() => setOpen('new')}>
            Add a recipe
          </button>
        </section>
      ) : (
        <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <div className="list">
            {recipes.map((r) => (
              <button key={r.id} className="list-item" onClick={() => setOpen(r)}>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{r.name}</div>
                  <div className="muted small">
                    {r.servings} serving{r.servings === 1 ? '' : 's'} · {r.ingredients.length} ingredient
                    {r.ingredients.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num entry-cal">{fmt(perServing(r))}</div>
                  <div className="muted small">per serving</div>
                </div>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {open && (
        <RecipeSheet
          recipe={open === 'new' ? undefined : open}
          onClose={() => setOpen(null)}
          onLogged={(m) => {
            setToast(m)
            setTimeout(() => setToast(null), 2200)
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

type AIState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string }

function RecipeSheet({ recipe, onClose, onLogged }: { recipe?: Recipe; onClose: () => void; onLogged: (m: string) => void }) {
  const [name, setName] = useState(recipe?.name ?? '')
  const [servings, setServings] = useState<number | ''>(recipe?.servings ?? 4)
  const [text, setText] = useState(recipe?.text ?? '')
  const [items, setItems] = useState<Ingredient[]>(recipe?.ingredients ?? [])
  const [note, setNote] = useState(recipe?.note ?? '')
  const [ai, setAI] = useState<AIState>({ kind: 'idle' })
  const [apiKey, setApiKey] = useState('')
  const [editing, setEditing] = useState(!recipe) // existing recipes open in "log" view
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Logging
  const [amount, setAmount] = useState<number>(1)
  const [logMeal, setLogMeal] = useState<Meal>(mealForNow())

  useEffect(() => {
    getKV<string>('anthropicKey').then((k) => setApiKey(k || ''))
  }, [])

  const total = items.reduce((s, i) => s + (i.calories || 0), 0)
  const per = servings ? Math.round(total / servings) : 0
  const valid = name.trim() !== '' && servings !== '' && servings > 0 && items.length > 0

  async function estimate() {
    setAI({ kind: 'loading' })
    try {
      const r = await estimateRecipe(apiKey, `${name ? `Recipe: ${name}\n` : ''}Makes ${servings || 'unknown'} servings.\n\n${text}`)
      setItems(r.ingredients)
      setNote(r.note)
      if (!name.trim()) setName(r.name)
      setAI({ kind: 'idle' })
    } catch (e) {
      setAI({ kind: 'error', message: explain(e).message })
    }
  }

  async function save() {
    if (!valid) return
    const data = { name: name.trim(), servings: servings as number, ingredients: items, totalCalories: total, text, note }
    if (recipe?.id) await db.recipes.update(recipe.id, data)
    else await db.recipes.add({ ...data, createdAt: Date.now() })
    onClose()
  }

  async function log() {
    if (!recipe) return
    const cal = Math.round(perServing(recipe) * amount)
    const label = amount === 1 ? '1 serving' : `${amount} servings`
    await db.entries.add({
      date: todayISO(),
      meal: logMeal,
      description: `${recipe.name} (${label})`,
      calories: cal,
      source: 'recipe',
      createdAt: Date.now(),
    })
    onClose()
    onLogged(`Added to today's ${MEAL_LABEL[logMeal].toLowerCase()}`)
  }

  const setItem = (i: number, patch: Partial<Ingredient>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))

  // ---------- Log view for a saved recipe ----------
  if (recipe && !editing) {
    const ps = perServing(recipe)
    return (
      <Sheet
        title={recipe.name}
        onClose={onClose}
        footer={
          <button className="btn block" onClick={log}>
            Add to today · {fmt(ps * amount)} cal
          </button>
        }
      >
        <section className="card accent stack">
          <div className="row between">
            <div>
              <div className="label">Per serving</div>
              <div className="big-number num">{fmt(ps)}</div>
            </div>
            <div style={{ textAlign: 'right' }} className="muted small">
              {fmt(recipe.totalCalories)} cal total
              <br />
              makes {recipe.servings}
            </div>
          </div>
        </section>
        <div className="field">
          <span style={{ fontWeight: 600, fontSize: 15 }}>How much did you have?</span>
          <Seg
            label="Servings"
            value={String(amount)}
            onChange={(v) => setAmount(Number(v))}
            options={['0.5', '1', '1.5', '2'].map((v) => ({ value: v, label: v === '0.5' ? '½' : v === '1.5' ? '1½' : v }))}
          />
        </div>
        <div className="field">
          <span style={{ fontWeight: 600, fontSize: 15 }}>Meal</span>
          <Seg label="Meal" value={logMeal} onChange={setLogMeal} options={MEALS.map((x) => ({ value: x, label: MEAL_LABEL[x] }))} />
        </div>
        <section className="card flat stack">
          <h3>Ingredients</h3>
          <div className="items">
            {recipe.ingredients.map((it, i) => (
              <div key={i} className="item-row">
                <div className="grow">
                  <div style={{ fontWeight: 650 }}>{it.name}</div>
                  <div className="muted small">{it.amount}</div>
                </div>
                <span className="num muted">{fmt(it.calories)}</span>
              </div>
            ))}
          </div>
          {recipe.note && <p className="note">{recipe.note}</p>}
        </section>
        <button className="btn secondary block" onClick={() => setEditing(true)}>
          Edit recipe
        </button>
      </Sheet>
    )
  }

  // ---------- Edit / create ----------
  return (
    <Sheet
      title={recipe ? 'Edit recipe' : 'New recipe'}
      onClose={onClose}
      footer={
        <button className="btn block" disabled={!valid || ai.kind === 'loading'} onClick={save}>
          Save recipe{valid ? ` · ${fmt(per)} cal/serving` : ''}
        </button>
      }
    >
      <label className="field">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Turkey chili" autoCapitalize="words" />
      </label>
      <NumberField label="Makes how many servings?" value={servings} onChange={setServings} />
      <label className="field">
        Ingredients
        <span className="hint">Paste or type the ingredient list with amounts, one per line.</span>
        <textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'1 lb ground turkey\n1 can black beans, drained\n1 can diced tomatoes\n1 onion\n1 tbsp olive oil'}
        />
      </label>

      {apiKey ? (
        <button
          className={`btn block ai-btn${ai.kind === 'loading' ? ' loading' : ''}`}
          disabled={text.trim().length < 5 || ai.kind === 'loading'}
          onClick={estimate}
        >
          <SparkleIcon /> {ai.kind === 'loading' ? 'Working out the calories…' : items.length ? 'Re-estimate calories' : 'Estimate calories'}
        </button>
      ) : (
        <p className="note">
          Tip: with AI estimates on (More → AI estimates), Claude can work out each ingredient's calories for you.
          Without it, add ingredients and their calories below.
        </p>
      )}
      {ai.kind === 'error' && (
        <div className="card warn flat small" role="alert">
          {ai.message}
        </div>
      )}

      <section className="card stack">
        <div className="row between">
          <h3>Breakdown</h3>
          {items.length > 0 && <span className="muted small num">{fmt(total)} cal total</span>}
        </div>
        {note && <p className="small muted">{note}</p>}
        {items.length > 0 && (
          <div className="items">
            {items.map((it, i) => (
              <div key={i} className="item-row">
                <div className="grow stack" style={{ gap: 4 }}>
                  <input className="item-name" value={it.name} aria-label="Ingredient" onChange={(e) => setItem(i, { name: e.target.value })} />
                  <input className="item-amt" value={it.amount} aria-label="Amount" placeholder="amount" onChange={(e) => setItem(i, { amount: e.target.value })} />
                </div>
                <input
                  className="item-cal"
                  type="number"
                  inputMode="numeric"
                  aria-label={`Calories for ${it.name}`}
                  value={it.calories}
                  onChange={(e) => setItem(i, { calories: e.target.value === '' ? 0 : Number(e.target.value) })}
                />
                <button className="item-x" aria-label={`Remove ${it.name}`} onClick={() => setItems(items.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setItems([...items, { name: '', amount: '', calories: 0 }])}>
          + Add ingredient
        </button>
        {items.length > 0 && servings !== '' && servings > 0 && (
          <div className="row between portion-total">
            <span className="muted">Per serving ({servings} servings)</span>
            <span className="stat num">{fmt(per)} cal</span>
          </div>
        )}
      </section>

      {recipe &&
        (confirmDelete ? (
          <div className="card warn flat stack">
            <p>Delete “{recipe.name}”? Servings you've already logged stay in your history.</p>
            <div className="row">
              <button className="btn secondary grow" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button
                className="btn grow"
                style={{ background: 'var(--danger)' }}
                onClick={async () => {
                  await db.recipes.delete(recipe.id!)
                  onClose()
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button className="btn danger block" onClick={() => setConfirmDelete(true)}>
            Delete recipe
          </button>
        ))}
    </Sheet>
  )
}
