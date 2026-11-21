import { useEffect, useState } from 'react'
import { explain, getApiKey, setApiKey, testKey } from '../lib/ai'

type Status = { kind: 'idle' } | { kind: 'testing' } | { kind: 'ok' } | { kind: 'error'; message: string }

export default function AISettings({ onBack }: { onBack: () => void }) {
  const [saved, setSaved] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    getApiKey().then(setSaved)
  }, [])

  async function saveAndTest() {
    const key = draft.trim()
    if (!key) return
    setStatus({ kind: 'testing' })
    try {
      await testKey(key)
      await setApiKey(key)
      setSaved(key)
      setDraft('')
      setStatus({ kind: 'ok' })
    } catch (e) {
      setStatus({ kind: 'error', message: explain(e).message.replace(' Check it in More → AI estimates.', '') })
    }
  }

  async function retest() {
    if (!saved) return
    setStatus({ kind: 'testing' })
    try {
      await testKey(saved)
      setStatus({ kind: 'ok' })
    } catch (e) {
      setStatus({ kind: 'error', message: explain(e).message })
    }
  }

  async function remove() {
    await setApiKey('')
    setSaved('')
    setConfirmRemove(false)
    setStatus({ kind: 'idle' })
  }

  const masked = saved ? `${saved.slice(0, 10)}…${saved.slice(-4)}` : ''

  return (
    <div className="screen fade-in">
      <button className="btn ghost" style={{ alignSelf: 'flex-start', marginLeft: -8 }} onClick={onBack}>
        ‹ More
      </button>
      <div className="header">
        <div>
          <div className="eyebrow">Photo &amp; text estimates</div>
          <h1>AI estimates</h1>
        </div>
      </div>

      <p className="muted">
        Snap a photo or describe a meal and Claude estimates the calories. It needs your own Anthropic API key, which is
        stored only on this phone and sent only to Anthropic.
      </p>

      {saved ? (
        <section className="card stack">
          <div className="row between">
            <div>
              <div className="label">Your key</div>
              <div className="num" style={{ fontWeight: 700 }}>{masked}</div>
            </div>
            <span className="pill good">On</span>
          </div>
          <div className="row">
            <button className="btn secondary grow" onClick={retest} disabled={status.kind === 'testing'}>
              {status.kind === 'testing' ? 'Testing…' : 'Test key'}
            </button>
            <button className="btn danger" onClick={() => setConfirmRemove(true)}>
              Remove
            </button>
          </div>
          {confirmRemove && (
            <div className="card warn flat stack">
              <p>Remove the key? Photo and text estimates will turn off until you add one again.</p>
              <div className="row">
                <button className="btn secondary grow" onClick={() => setConfirmRemove(false)}>
                  Keep it
                </button>
                <button className="btn grow" style={{ background: 'var(--danger)' }} onClick={remove}>
                  Remove
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="card stack">
          <label className="field">
            Paste your API key
            <input
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setStatus({ kind: 'idle' })
              }}
            />
          </label>
          <button className="btn block" disabled={!draft.trim() || status.kind === 'testing'} onClick={saveAndTest}>
            {status.kind === 'testing' ? 'Checking…' : 'Save and test'}
          </button>
        </section>
      )}

      {status.kind === 'ok' && <div className="card good flat">The key works. AI estimates are on.</div>}
      {status.kind === 'error' && <div className="card warn flat">{status.message}</div>}

      <section className="card flat stack small">
        <h3>Getting a key</h3>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
          <li>
            Go to <strong>console.anthropic.com</strong> and sign up.
          </li>
          <li>
            Under <strong>Billing</strong>, add a payment method and a small amount of credit.
          </li>
          <li>
            Under <strong>Limits</strong>, set a monthly spend limit (for example $10).
          </li>
          <li>
            Under <strong>API Keys</strong>, create a key, copy it and paste it above.
          </li>
        </ol>
        <p className="muted">
          A photo estimate costs about 1–2¢ and a text estimate under 1¢, so a few a day is usually a few dollars a
          month. Uses Claude Sonnet 5.5.
        </p>
      </section>
    </div>
  )
}
