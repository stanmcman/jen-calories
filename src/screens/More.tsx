import { useLiveQuery } from 'dexie-react-hooks'
import { db, getKV, type Profile } from '../db'
import { ACTIVITY, computeGoal } from '../lib/calc'
import { fmt } from '../lib/dates'
import { saveTheme, type ThemePref } from '../lib/theme'
import { Seg } from '../components/ui'

export default function More({
  profile,
  onEditGoal,
  onOpenFavorites,
  onOpenAI,
  onOpenRecipes,
  onOpenFoodDb,
}: {
  profile: Profile
  onEditGoal: () => void
  onOpenFavorites: () => void
  onOpenAI: () => void
  onOpenRecipes: () => void
  onOpenFoodDb: () => void
}) {
  const recipeCount = useLiveQuery(() => db.recipes.count()) ?? 0
  const hasKey = useLiveQuery(async () => !!(await getKV<string>('anthropicKey'))) ?? false
  const favCount = useLiveQuery(() => db.favorites.count()) ?? 0
  const g = computeGoal(profile)
  const theme = useLiveQuery(async () => (await getKV<ThemePref>('theme')) ?? 'system') ?? 'system'
  return (
    <div className="screen fade-in">
      <div className="header">
        <div>
          <div className="eyebrow">Settings &amp; extras</div>
          <h1>More</h1>
        </div>
      </div>
      <section className="card">
        <div className="list">
          <button className="list-item" onClick={onEditGoal}>
            <div className="grow">
              <h3>Daily goal</h3>
              <div className="muted small">
                {fmt(g.goal)} cal ·{' '}
                {profile.goal === 'maintain'
                  ? 'Maintain'
                  : `${profile.goal === 'lose' ? 'Lose' : 'Gain'} ${profile.pace} lb/wk`}{' '}
                · {ACTIVITY[profile.activity].label}
              </div>
            </div>
            <span className="chev">›</span>
          </button>
          <button className="list-item" onClick={onOpenFavorites}>
            <div className="grow">
              <h3>Favorites</h3>
              <div className="muted small">
                {favCount === 0 ? 'Foods you eat often' : `${favCount} saved food${favCount === 1 ? '' : 's'}`}
              </div>
            </div>
            <span className="chev">›</span>
          </button>
          <button className="list-item" onClick={onOpenRecipes}>
            <div className="grow">
              <h3>Recipes</h3>
              <div className="muted small">
                {recipeCount === 0 ? 'Calories per serving for home cooking' : `${recipeCount} saved recipe${recipeCount === 1 ? '' : 's'}`}
              </div>
            </div>
            <span className="chev">›</span>
          </button>
          <button className="list-item" onClick={onOpenAI}>
            <div className="grow">
              <h3>AI estimates</h3>
              <div className="muted small">{hasKey ? 'On · photo and text estimates' : 'Off · add an API key to turn on'}</div>
            </div>
            <span className={`pill${hasKey ? ' good' : ''}`}>{hasKey ? 'On' : 'Off'}</span>
            <span className="chev">›</span>
          </button>
          <button className="list-item" onClick={onOpenFoodDb}>
            <div className="grow">
              <h3>Food databases</h3>
              <div className="muted small">Barcode scanning and food search</div>
            </div>
            <span className="chev">›</span>
          </button>
        </div>
      </section>

      <section className="card stack">
        <h3>Appearance</h3>
        <Seg
          label="Appearance"
          value={theme}
          onChange={(v) => saveTheme(v)}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
        />
        <p className="note">System follows your iPhone's setting, switching to dark at night if you've set it to.</p>
      </section>

      <p className="note">Backups will appear here in the final stage.</p>
    </div>
  )
}
