import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getKV } from '../db'
import { readBackup, saveBackup, type ParsedBackup } from '../lib/backup'

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

type Status = { kind: 'idle' } | { kind: 'working' } | { kind: 'ok'; message: string } | { kind: 'error'; message: string }

export default function Backup({ onBack }: { onBack: () => void }) {
  const last = useLiveQuery(() => getKV<number>('lastBackup'))
  const counts = useLiveQuery(async () => ({
    entries: await db.entries.count(),
    photos: await db.entries.filter((e) => !!e.photo).count(),
    weights: await db.weights.count(),
  }))
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function doBackup() {
    setStatus({ kind: 'working' })
    try {
      const r = await saveBackup()
      setStatus(
        r === 'cancelled'
          ? { kind: 'idle' }
          : { kind: 'ok', message: r === 'shared' ? 'Backup ready. Choose “Save to Files” to keep it in iCloud Drive.' : 'Backup saved to your Downloads.' },
      )
    } catch {
      setStatus({ kind: 'error', message: "Couldn't create the backup. Try again." })
    }
  }

  async function pick(file?: File) {
    if (!file) return
    try {
      setPending(await readBackup(file))
      setStatus({ kind: 'idle' })
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : "Couldn't read that file." })
    }
  }

  async function restore() {
    if (!pending) return
    setStatus({ kind: 'working' })
    try {
      await pending.restore()
      setPending(null)
      setStatus({ kind: 'ok', message: 'Restored. Everything from the backup is back.' })
    } catch {
      setStatus({ kind: 'error', message: "Couldn't restore that backup. Nothing was changed." })
    }
  }

  const lastText = last
    ? new Date(last).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never'

  return (
    <div className="screen fade-in">
      <button className="btn ghost" style={{ alignSelf: 'flex-start', marginLeft: -8 }} onClick={onBack}>
        ‹ More
      </button>
      <div className="header">
        <div>
          <div className="eyebrow">Keep it safe</div>
          <h1>Backup</h1>
        </div>
      </div>

      <p className="muted">
        Everything lives only on this phone. A backup saves it to a file you keep, in iCloud Drive for example, so you can
        restore it on a new phone or if the app is ever removed.
      </p>

      <section className="card stack">
        <div className="row between">
          <div>
            <div className="label">Last backup</div>
            <div style={{ fontWeight: 750 }}>{lastText}</div>
          </div>
          {counts && (
            <div className="muted small" style={{ textAlign: 'right' }}>
              {plural(counts.entries, 'food')} · {plural(counts.photos, 'photo')}
              <br />
              {plural(counts.weights, 'weigh-in')}
            </div>
          )}
        </div>
        <button className="btn block" onClick={doBackup} disabled={status.kind === 'working'}>
          {status.kind === 'working' && !pending ? 'Preparing…' : 'Back up now'}
        </button>
        <p className="note">
          On iPhone, choose <strong>Save to Files</strong>, then <strong>iCloud Drive</strong>. Your API keys aren't
          included, for safety.
        </p>
      </section>

      <section className="card stack">
        <h3>Restore from a backup</h3>
        <p className="small muted">This replaces everything currently in the app with what's in the backup file.</p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {!pending ? (
          <button className="btn secondary block" onClick={() => fileInput.current?.click()}>
            Choose backup file
          </button>
        ) : (
          <div className="card warn flat stack">
            <p>
              Backup from{' '}
              <strong>
                {pending.exportedAt ? new Date(pending.exportedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown date'}
              </strong>{' '}
              with {plural(pending.counts.entries, 'food')}, {plural(pending.counts.weights, 'weigh-in')},{' '}
              {plural(pending.counts.favorites, 'favorite')} and {plural(pending.counts.recipes, 'recipe')}. Replace what's in the app now?
            </p>
            <div className="row">
              <button className="btn secondary grow" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button className="btn grow" onClick={restore} disabled={status.kind === 'working'}>
                Replace &amp; restore
              </button>
            </div>
          </div>
        )}
      </section>

      {status.kind === 'ok' && <div className="card good flat">{status.message}</div>}
      {status.kind === 'error' && (
        <div className="card warn flat" role="alert">
          {status.message}
        </div>
      )}
    </div>
  )
}
