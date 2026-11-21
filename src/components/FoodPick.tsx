import { useEffect, useRef, useState } from 'react'
import { lookupBarcode, lookupMessage, searchFoods, type FoodInfo } from '../lib/foods'
import { fmt } from '../lib/dates'

export interface Picked {
  description: string
  calories: number
  protein?: number
  carbs?: number
  fat?: number
}

const r = (x: number) => Math.round(x)

// ---------------- Portion picker ----------------

export function PortionPicker({ food, onUse, onBack }: { food: FoodInfo; onUse: (p: Picked) => void; onBack: () => void }) {
  const options: { label: string; grams: number; serving?: boolean }[] = [...food.measures, { label: food.unit === 'ml' ? 'milliliters' : 'grams', grams: 1 }]
  const [unitIdx, setUnitIdx] = useState(0)
  const [amount, setAmount] = useState<number | ''>(options[0].grams === 1 ? 100 : 1)
  const unit = options[unitIdx]
  const grams = amount === '' ? 0 : amount * unit.grams
  const f = grams / 100
  const cal = food.kcal100 * f

  function use() {
    const amt = amount === '' ? 0 : amount
    const portion =
      unit.grams === 1 && !unit.serving
        ? `${amt} ${food.unit}`
        : unit.serving
          ? `${amt} ${amt === 1 ? 'serving' : 'servings'}`
          : amt === 1
            ? unit.label
            : `${amt} × ${unit.label}`
    onUse({
      // Skip the brand if the name already includes it ("Cheerios" by "Cheerios")
      description: `${food.brand && !food.name.toLowerCase().includes(food.brand.toLowerCase()) ? `${food.brand} ` : ''}${food.name}, ${portion}`,
      calories: r(cal),
      protein: food.protein100 !== undefined ? r(food.protein100 * f) : undefined,
      carbs: food.carbs100 !== undefined ? r(food.carbs100 * f) : undefined,
      fat: food.fat100 !== undefined ? r(food.fat100 * f) : undefined,
    })
  }

  return (
    <section className="card stack fade-in">
      <div>
        {food.brand && <div className="label">{food.brand}</div>}
        <h3>{food.name}</h3>
        <div className="muted small">
          {fmt(food.kcal100)} cal per 100 {food.unit} · from {food.source}
        </div>
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ width: 110 }}>
          Amount
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
        <label className="field grow">
          Unit
          <select
            value={unitIdx}
            onChange={(e) => {
              const i = Number(e.target.value)
              setUnitIdx(i)
              setAmount(options[i].grams === 1 ? 100 : 1)
            }}
          >
            {options.map((o, i) => (
              <option key={i} value={i}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row between portion-total">
        <span className="muted">That's about</span>
        <span className="stat num">{fmt(cal)} cal</span>
      </div>
      <div className="row">
        <button className="btn secondary" onClick={onBack}>
          Back
        </button>
        <button className="btn grow" disabled={amount === '' || amount <= 0} onClick={use}>
          Use this
        </button>
      </div>
    </section>
  )
}

// ---------------- Barcode scanner ----------------

export function BarcodeScan({ onUse }: { onUse: (p: Picked) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<'starting' | 'on' | 'off' | 'denied'>('starting')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [food, setFood] = useState<FoodInfo | null>(null)
  const stopRef = useRef<() => void>(() => {})

  async function lookup(c: string) {
    setBusy(true)
    setError(null)
    try {
      setFood(await lookupBarcode(c))
      stopRef.current()
    } catch (e) {
      setError(lookupMessage(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (food) return
    let cancelled = false
    let seen = ''
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera('off')
        return
      }
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const { BarcodeFormat, DecodeHintType } = await import('@zxing/library')
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ])
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 })
        if (cancelled || !video.current) return
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          video.current,
          (result) => {
            if (!result) return
            const text = result.getText()
            if (text === seen) return
            seen = text
            navigator.vibrate?.(40)
            setCode(text)
            lookup(text)
          },
        )
        stopRef.current = () => controls.stop()
        if (cancelled) controls.stop()
        else setCamera('on')
      } catch (e) {
        setCamera(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'off')
      }
    })()
    return () => {
      cancelled = true
      stopRef.current()
    }
  }, [food])

  if (food) return <PortionPicker food={food} onUse={onUse} onBack={() => setFood(null)} />

  return (
    <div className="stack">
      <div className="scanner">
        <video ref={video} muted playsInline />
        {camera === 'on' && <div className="scan-frame" aria-hidden />}
        {camera !== 'on' && (
          <div className="scanner-msg">
            {camera === 'starting'
              ? 'Starting camera…'
              : camera === 'denied'
                ? 'Camera access is off. You can allow it in iPhone Settings, or type the number below.'
                : 'Camera not available. Type the barcode number below.'}
          </div>
        )}
      </div>
      {camera === 'on' && <p className="note" style={{ textAlign: 'center' }}>Point the camera at the barcode. It scans by itself.</p>}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field grow">
          Or type the barcode number
          <input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 016000275287"
            enterKeyHint="search"
            onKeyDown={(e) => e.key === 'Enter' && code.trim() && lookup(code)}
          />
        </label>
        <button className="btn" disabled={!code.trim() || busy} onClick={() => lookup(code)}>
          {busy ? '…' : 'Look up'}
        </button>
      </div>
      {busy && <p className="muted small">Looking it up…</p>}
      {error && (
        <div className="card warn flat small" role="alert">
          {error}
        </div>
      )}
      <p className="note">Barcode data comes from Open Food Facts, a free, volunteer-built database.</p>
    </div>
  )
}

// ---------------- Food search ----------------

export function FoodSearch({ onUse }: { onUse: (p: Picked) => void }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<FoodInfo[] | null>(null)
  const [food, setFood] = useState<FoodInfo | null>(null)

  async function go() {
    if (!q.trim()) return
    setBusy(true)
    setError(null)
    try {
      const r = await searchFoods(q.trim())
      setResults(r)
    } catch (e) {
      setError(lookupMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (food) return <PortionPicker food={food} onUse={onUse} onBack={() => setFood(null)} />

  return (
    <div className="stack">
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          go()
        }}
      >
        <input
          type="search"
          className="grow"
          placeholder="Search foods, e.g. banana"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="search"
        />
        <button className="btn" type="submit" disabled={!q.trim() || busy}>
          {busy ? '…' : 'Search'}
        </button>
      </form>
      {error && (
        <div className="card warn flat small" role="alert">
          {error}
        </div>
      )}
      {results && results.length === 0 && <p className="muted">No matches. Try fewer or simpler words.</p>}
      {results && results.length > 0 && (
        <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <div className="list">
            {results.map((f, i) => (
              <button key={i} className="list-item" onClick={() => setFood(f)}>
                <div className="grow">
                  <div style={{ fontWeight: 650 }}>{f.name}</div>
                  <div className="muted small">
                    {f.brand ? `${f.brand} · ` : ''}
                    {f.measures[0] ? f.measures[0].label : `per 100 ${f.unit}`}
                  </div>
                </div>
                <span className="num entry-cal">
                  {fmt(f.measures[0] ? (f.kcal100 * f.measures[0].grams) / 100 : f.kcal100)}
                </span>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="note">Search uses USDA FoodData Central, the US government's free nutrition database.</p>
    </div>
  )
}
