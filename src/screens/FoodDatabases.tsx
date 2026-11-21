import { useEffect, useState } from 'react'
import { getUsdaKey, setUsdaKey } from '../lib/foods'

export default function FoodDatabases({ onBack }: { onBack: () => void }) {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    getUsdaKey().then(setKey)
  }, [])

  return (
    <div className="screen fade-in">
      <button className="btn ghost" style={{ alignSelf: 'flex-start', marginLeft: -8 }} onClick={onBack}>
        ‹ More
      </button>
      <div className="header">
        <div>
          <div className="eyebrow">Free, no AI needed</div>
          <h1>Food databases</h1>
        </div>
      </div>
      <section className="card stack">
        <h3>Barcode scanning</h3>
        <p className="small muted">
          Uses Open Food Facts, a free, volunteer-built database of packaged foods. Nothing to set up. Coverage is good for
          big brands; if a product isn't found, try Search or enter it yourself.
        </p>
      </section>
      <section className="card stack">
        <h3>Food search</h3>
        <p className="small muted">
          Uses USDA FoodData Central, the US government's nutrition database. It works out of the box with a shared demo
          key that allows a limited number of searches per hour. For unlimited searching, get a free key in a minute:
        </p>
        <ol className="small" style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}>
          <li>
            Go to <strong>api.data.gov/signup</strong>
          </li>
          <li>Enter your name and email. The key arrives by email right away.</li>
          <li>Paste it below.</li>
        </ol>
        <label className="field">
          USDA key (optional)
          <input
            value={key}
            onChange={(e) => {
              setKey(e.target.value)
              setSaved(false)
            }}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Using the shared demo key"
          />
        </label>
        <button
          className="btn"
          onClick={async () => {
            await setUsdaKey(key)
            setSaved(true)
          }}
        >
          Save
        </button>
        {saved && <div className="card good flat small">Saved.</div>}
      </section>
    </div>
  )
}
