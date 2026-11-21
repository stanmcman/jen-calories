import { useLiveQuery } from 'dexie-react-hooks'
import { getKV, type Profile } from '../db'
import { ACTIVITY, computeGoal } from '../lib/calc'
import { fmt } from '../lib/dates'
import { saveTheme, type ThemePref } from '../lib/theme'
import { Seg } from '../components/ui'

export default function More({ profile, onEditGoal }: { profile: Profile; onEditGoal: () => void }) {
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

      <p className="note">Favorites, recipes, AI keys and backups will appear here in later stages.</p>
    </div>
  )
}
