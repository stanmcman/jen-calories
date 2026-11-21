import type { ReactNode } from 'react'

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Options<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; sub?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="options">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className="option"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          <span className="dot" />
          <span>
            <strong>{o.label}</strong>
            {o.sub && <span className="sub">{o.sub}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  hint,
  placeholder,
  step = 1,
}: {
  label: string
  value: number | ''
  onChange: (v: number | '') => void
  suffix?: string
  hint?: ReactNode
  placeholder?: string
  step?: number
}) {
  return (
    <label className="field">
      {label}
      <div className="input-suffix">
        <input
          inputMode={step < 1 ? 'decimal' : 'numeric'}
          type="number"
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        {suffix && <span>{suffix}</span>}
      </div>
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}
