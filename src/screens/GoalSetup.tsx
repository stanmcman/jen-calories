import { useMemo, useState } from 'react'
import { db, setKV, type Activity, type GoalType, type Profile, type Sex } from '../db'
import { ACTIVITY, PACES, computeGoal, defaultPace } from '../lib/calc'
import { fmt, todayISO } from '../lib/dates'
import { NumberField, Options, Seg } from '../components/ui'
import { recordGoal } from '../lib/goals'

type Draft = {
  sex: Sex
  age: number | ''
  heightFt: number | ''
  heightIn: number | ''
  weightLb: number | ''
  activity: Activity
  goal: GoalType
  pace: number
  goalWeightLb: number | ''
  customGoal: number | ''
}

const fromProfile = (p?: Profile): Draft => ({
  sex: p?.sex ?? 'female',
  age: p?.age ?? '',
  heightFt: p?.heightFt ?? '',
  heightIn: p?.heightIn ?? '',
  weightLb: p?.weightLb ?? '',
  activity: p?.activity ?? 'light',
  goal: p?.goal ?? 'lose',
  pace: p?.pace ?? 1,
  goalWeightLb: p?.goalWeightLb ?? '',
  customGoal: p?.customGoal ?? '',
})

function toProfile(d: Draft): Profile | null {
  if (d.age === '' || d.heightFt === '' || d.weightLb === '') return null
  if (d.age < 13 || d.age > 110 || d.heightFt < 3 || d.heightFt > 8 || d.weightLb < 60 || d.weightLb > 700) return null
  return {
    sex: d.sex,
    age: d.age,
    heightFt: d.heightFt,
    heightIn: d.heightIn === '' ? 0 : d.heightIn,
    weightLb: d.weightLb,
    activity: d.activity,
    goal: d.goal,
    pace: d.goal === 'maintain' ? 0 : d.pace,
    goalWeightLb: d.goalWeightLb === '' ? undefined : d.goalWeightLb,
    customGoal: d.customGoal === '' ? undefined : d.customGoal,
    updatedAt: Date.now(),
  }
}

export default function GoalSetup({
  initial,
  firstRun,
  onDone,
}: {
  initial?: Profile
  firstRun?: boolean
  onDone: () => void
}) {
  const [d, setD] = useState<Draft>(() => fromProfile(initial))
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }))

  const profile = useMemo(() => toProfile(d), [d])
  const result = useMemo(() => (profile ? computeGoal(profile) : null), [profile])

  async function save() {
    if (!profile) return
    setSaving(true)
    await setKV('profile', profile)
    const today = todayISO()
    await recordGoal(today, computeGoal(profile).goal)
    // Record the weight as a weigh-in for today if it's new or changed.
    const existing = await db.weights.where('date').equals(today).first()
    if (!existing) {
      const last = await db.weights.orderBy('date').last()
      if (!last || last.weightLb !== profile.weightLb) await db.weights.add({ date: today, weightLb: profile.weightLb })
    } else if (existing.weightLb !== profile.weightLb) {
      await db.weights.update(existing.id!, { weightLb: profile.weightLb })
    }
    if (firstRun) await setKV('startWeight', { date: today, weightLb: profile.weightLb })
    setSaving(false)
    onDone()
  }

  return (
    <div className="screen fade-in">
      <div className="header">
        <div>
          <div className="eyebrow">{firstRun ? 'Welcome to Nibbles & Bits' : 'Settings'}</div>
          <h1>{firstRun ? "Let's find your number" : 'Your daily goal'}</h1>
        </div>
        {!firstRun && (
          <button className="btn ghost" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
      {firstRun && (
        <p className="muted">
          A few quick questions, and we'll work out how many calories a day fits your goal. You can change any of this
          later.
        </p>
      )}

      <section className="card stack">
        <h3>About you</h3>
        <Seg
          label="Sex"
          value={d.sex}
          onChange={(v) => set('sex', v)}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
          ]}
        />
        <NumberField label="Age" value={d.age} onChange={(v) => set('age', v)} suffix="yrs" />
        <div className="row">
          <div className="grow">
            <NumberField label="Height" value={d.heightFt} onChange={(v) => set('heightFt', v)} suffix="ft" />
          </div>
          <div className="grow">
            <NumberField label="&nbsp;" value={d.heightIn} onChange={(v) => set('heightIn', v)} suffix="in" />
          </div>
        </div>
        <NumberField
          label="Current weight"
          value={d.weightLb}
          onChange={(v) => set('weightLb', v)}
          suffix="lb"
          step={0.1}
        />
      </section>

      <section className="card stack">
        <h3>How active are you?</h3>
        <Options
          value={d.activity}
          onChange={(v) => set('activity', v)}
          options={(Object.keys(ACTIVITY) as Activity[]).map((k) => ({
            value: k,
            label: ACTIVITY[k].label,
            sub: ACTIVITY[k].hint,
          }))}
        />
      </section>

      <section className="card stack">
        <h3>Your goal</h3>
        <Seg
          label="Goal"
          value={d.goal}
          onChange={(v) => setD((s) => ({ ...s, goal: v, pace: defaultPace(v) }))}
          options={[
            { value: 'lose', label: 'Lose' },
            { value: 'maintain', label: 'Maintain' },
            { value: 'gain', label: 'Gain' },
          ]}
        />
        {d.goal !== 'maintain' && (
          <Options
            value={d.pace}
            onChange={(v) => set('pace', v)}
            options={PACES[d.goal].map((p) => ({ value: p.lbPerWeek, label: p.label }))}
          />
        )}
        {d.goal !== 'maintain' && (
          <NumberField
            label="Goal weight (optional)"
            value={d.goalWeightLb}
            onChange={(v) => set('goalWeightLb', v)}
            suffix="lb"
            step={0.1}
          />
        )}
      </section>

      {result && profile ? (
        <section className="card accent stack fade-in" aria-live="polite">
          <div className="eyebrow">Your daily goal</div>
          <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
            <span className="big-number">{fmt(result.goal)}</span>
            <span className="muted">calories a day</span>
          </div>
          <p>
            Your body burns about <strong>{fmt(result.tdee)}</strong> calories a day.
            {(() => {
              const diff = result.goal - result.tdee // actual daily difference after any floor/custom
              const lbWk = Math.round((Math.abs(diff) * 7) / 3500 * 10) / 10
              if (Math.abs(diff) < 50) return ' Eating about that much keeps your weight steady.'
              if (diff < 0) return ` Eating about ${fmt(-diff)} less than that each day means losing about ${lbWk} lb a week.`
              return ` Eating about ${fmt(diff)} more than that each day means gaining about ${lbWk} lb a week.`
            })()}
          </p>
          <div className="math">
            <span className="muted">Resting burn (BMR)</span>
            <span className="num">{fmt(result.bmr)}</span>
            <span className="muted">× activity ({ACTIVITY[profile.activity].factor})</span>
            <span className="num">{fmt(result.tdee)}</span>
            {result.adjustment !== 0 && (
              <>
                <span className="muted">Goal adjustment</span>
                <span className="num">
                  {result.adjustment > 0 ? '+' : '−'}
                  {fmt(Math.abs(result.adjustment))}
                </span>
              </>
            )}
            {(result.hitFloor || result.usingCustom) && (
              <>
                <span className="muted">{result.hitFloor ? 'Raised to safe minimum' : 'Your own number'}</span>
                <span className="num">{fmt(result.goal)}</span>
              </>
            )}
            <span className="total">Daily goal</span>
            <span className="total num">{fmt(result.goal)}</span>
          </div>
          {result.hitFloor && (
            <div className="card warn flat small">
              We've set your goal to {fmt(result.floor)}, the safe minimum for{' '}
              {profile.sex === 'female' ? 'women' : 'men'}. Going lower than that isn't recommended without a doctor's
              guidance.
            </div>
          )}
        </section>
      ) : (
        <section className="card flat muted small">Fill in your age, height and weight to see your goal.</section>
      )}

      <details className="card flat">
        <summary style={{ fontWeight: 650 }}>Use my own number instead</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <NumberField
            label="Custom daily goal"
            value={d.customGoal}
            onChange={(v) => set('customGoal', v)}
            suffix="cal"
            hint={`Leave blank to use the calculated goal. It can't go below ${fmt(d.sex === 'female' ? 1200 : 1500)}.`}
          />
        </div>
      </details>

      <p className="note">
        This is an estimate for healthy adults. If you're pregnant, nursing, or managing a medical condition, check with
        your doctor about the right calorie goal for you.
      </p>

      <button className="btn block" disabled={!profile || saving} onClick={save}>
        {firstRun ? "Let's go" : 'Save goal'}
      </button>
    </div>
  )
}
