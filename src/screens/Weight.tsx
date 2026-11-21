import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getKV, setKV, type Profile, type WeightLog } from '../db'
import { computeGoal, weightDrifted } from '../lib/calc'
import { fmt, parseISO, prettyDate, todayISO } from '../lib/dates'
import { recordGoal } from '../lib/goals'
import WeightChart, { type Range } from '../components/WeightChart'
import Sheet from '../components/Sheet'
import { NumberField, Seg } from '../components/ui'

const r1 = (n: number) => Math.round(n * 10) / 10
const lb = (n: number) => `${r1(n).toLocaleString(undefined, { maximumFractionDigits: 1 })} lb`

export default function Weight({ profile }: { profile: Profile }) {
  const logs = useLiveQuery(() => db.weights.orderBy('date').toArray()) ?? []
  const start = useLiveQuery(() => getKV<{ date: string; weightLb: number }>('startWeight'))
  const dismissedAt = useLiveQuery(() => getKV<number>('recalcDismissedAt'))
  const [range, setRange] = useState<Range>('3m')
  const [editing, setEditing] = useState<WeightLog | 'new' | null>(null)
  const [showAll, setShowAll] = useState(false)

  const latest = logs.length ? logs[logs.length - 1] : undefined
  const startLb = start?.weightLb ?? logs[0]?.weightLb
  const goalLb = profile.goal !== 'maintain' ? profile.goalWeightLb : undefined
  const change = latest && startLb !== undefined ? latest.weightLb - startLb : 0
  const toGoal = latest && goalLb !== undefined ? latest.weightLb - goalLb : undefined
  const reached =
    toGoal !== undefined && ((profile.goal === 'lose' && toGoal <= 0) || (profile.goal === 'gain' && toGoal >= 0))

  // Offer to recalculate the calorie goal when her weight has moved 5+ lb from what the goal was based on.
  const drifted = latest && weightDrifted(profile.weightLb, latest.weightLb) && dismissedAt !== latest.weightLb
  const newGoal = latest ? computeGoal({ ...profile, weightLb: latest.weightLb }).goal : 0
  const oldGoal = computeGoal(profile).goal

  async function updateGoal() {
    if (!latest) return
    const p = { ...profile, weightLb: latest.weightLb, updatedAt: Date.now() }
    await setKV('profile', p)
    await recordGoal(todayISO(), computeGoal(p).goal)
  }

  const listed = [...logs].reverse()
  const shown = showAll ? listed : listed.slice(0, 8)

  return (
    <div className="screen fade-in">
      <div className="header">
        <div>
          <div className="eyebrow">Steady progress</div>
          <h1>Weight</h1>
        </div>
        <button className="btn" style={{ minHeight: 46 }} onClick={() => setEditing('new')}>
          + Log weight
        </button>
      </div>

      {latest ? (
        <section className="card stack">
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="label">Current</div>
              <div className="big-number num">
                {r1(latest.weightLb)}
                <span className="unit"> lb</span>
              </div>
              <div className="muted small">{prettyDate(latest.date)}</div>
            </div>
          </div>
          <div className="stat-row">
            <div>
              <div className="label">Since start</div>
              <div className="stat num">
                {change === 0 ? '—' : `${change < 0 ? '−' : '+'}${lb(Math.abs(change))}`}
              </div>
              {startLb !== undefined && <div className="muted small">from {lb(startLb)}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label">To goal</div>
              {goalLb === undefined ? (
                <div className="muted small" style={{ marginTop: 4 }}>
                  No goal weight set
                </div>
              ) : reached ? (
                <>
                  <div className="stat" style={{ color: 'var(--good)' }}>
                    Reached
                  </div>
                  <div className="muted small">goal {lb(goalLb)}</div>
                </>
              ) : (
                <>
                  <div className="stat num">{lb(Math.abs(toGoal!))}</div>
                  <div className="muted small">goal {lb(goalLb)}</div>
                </>
              )}
            </div>
          </div>
          {goalLb !== undefined && startLb !== undefined && startLb !== goalLb && (
            <Progress start={startLb} goal={goalLb} current={latest.weightLb} />
          )}
        </section>
      ) : (
        <section className="card flat muted">Log your first weigh-in to start tracking.</section>
      )}

      {drifted && (
        <section className="card accent stack fade-in">
          <h3>Update your daily goal?</h3>
          <p className="small">
            Your calorie goal was based on {lb(profile.weightLb)}. At {lb(latest!.weightLb)}, it would be{' '}
            <strong>{fmt(newGoal)}</strong> a day instead of {fmt(oldGoal)}.
          </p>
          <div className="row">
            <button className="btn secondary grow" onClick={() => setKV('recalcDismissedAt', latest!.weightLb)}>
              Not now
            </button>
            <button className="btn grow" onClick={updateGoal}>
              Update to {fmt(newGoal)}
            </button>
          </div>
        </section>
      )}

      {logs.length >= 2 && (
        <section className="card stack">
          <div className="row between">
            <h3>Trend</h3>
          </div>
          <Seg
            label="Time range"
            value={range}
            onChange={setRange}
            options={[
              { value: '1m', label: '1 mo' },
              { value: '3m', label: '3 mo' },
              { value: '6m', label: '6 mo' },
              { value: 'all', label: 'All' },
            ]}
          />
          <WeightChart logs={logs} range={range} startLb={startLb} goalLb={goalLb} />
        </section>
      )}

      {logs.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <h3 style={{ padding: '0 4px' }}>Weigh-ins</h3>
          <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <div className="list">
              {shown.map((w, i) => {
                const prev = listed[i + 1]
                const diff = prev ? w.weightLb - prev.weightLb : 0
                return (
                  <button key={w.id} className="list-item" onClick={() => setEditing(w)}>
                    <div className="grow">
                      <div style={{ fontWeight: 700 }}>
                        {parseISO(w.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    {prev && diff !== 0 && (
                      <span className="muted small num">
                        {diff < 0 ? '−' : '+'}
                        {r1(Math.abs(diff))}
                      </span>
                    )}
                    <span className="num entry-cal">{lb(w.weightLb)}</span>
                    <span className="chev">›</span>
                  </button>
                )
              })}
            </div>
          </div>
          {listed.length > 8 && (
            <button className="btn ghost" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show all ${listed.length}`}
            </button>
          )}
        </section>
      )}

      {editing && (
        <WeightSheet
          log={editing === 'new' ? undefined : editing}
          lastLb={latest?.weightLb}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function Progress({ start, goal, current }: { start: number; goal: number; current: number }) {
  const pct = Math.max(0, Math.min(1, (start - current) / (start - goal)))
  return (
    <div className="progress" role="img" aria-label={`${Math.round(pct * 100)}% of the way to your goal`}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="row between small muted">
        <span>{Math.round(pct * 100)}% of the way there</span>
      </div>
    </div>
  )
}

function WeightSheet({ log, lastLb, onClose }: { log?: WeightLog; lastLb?: number; onClose: () => void }) {
  const [date, setDate] = useState(log?.date ?? todayISO())
  const [w, setW] = useState<number | ''>(log?.weightLb ?? '')
  const [confirm, setConfirm] = useState(false)
  const valid = w !== '' && w >= 60 && w <= 700 && !!date

  async function save() {
    if (!valid) return
    const weightLb = r1(w as number)
    const sameDay = await db.weights.where('date').equals(date).first()
    if (log?.id) {
      if (sameDay && sameDay.id !== log.id) await db.weights.delete(sameDay.id!)
      await db.weights.update(log.id, { date, weightLb })
    } else if (sameDay) await db.weights.update(sameDay.id!, { weightLb })
    else await db.weights.add({ date, weightLb })
    onClose()
  }

  return (
    <Sheet
      title={log ? 'Edit weigh-in' : 'Log weight'}
      onClose={onClose}
      footer={
        <button className="btn block" disabled={!valid} onClick={save}>
          Save
        </button>
      }
    >
      <NumberField
        label="Weight"
        value={w}
        onChange={setW}
        suffix="lb"
        step={0.1}
        placeholder={lastLb ? String(lastLb) : undefined}
        hint={!log && lastLb ? `Last time: ${lastLb} lb` : 'One weigh-in per day; logging again replaces it.'}
      />
      <label className="field">
        Date
        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <p className="note">For the steadiest trend, weigh in at the same time of day, like first thing in the morning.</p>
      {log &&
        (confirm ? (
          <div className="card warn flat stack">
            <p>Delete this weigh-in?</p>
            <div className="row">
              <button className="btn secondary grow" onClick={() => setConfirm(false)}>
                Keep it
              </button>
              <button
                className="btn grow"
                style={{ background: 'var(--danger)' }}
                onClick={async () => {
                  await db.weights.delete(log.id!)
                  onClose()
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button className="btn danger block" onClick={() => setConfirm(true)}>
            Delete this weigh-in
          </button>
        ))}
    </Sheet>
  )
}
