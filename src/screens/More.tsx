import type { Profile } from '../db'
import { ACTIVITY, computeGoal } from '../lib/calc'
import { fmt } from '../lib/dates'

export default function More({ profile, onEditGoal }: { profile: Profile; onEditGoal: () => void }) {
  const g = computeGoal(profile)
  return (
    <div className="screen fade-in">
      <div className="header">
        <h1>More</h1>
      </div>
      <section className="card">
        <div className="list">
          <button className="list-item" onClick={onEditGoal}>
            <div className="grow">
              <h3>Daily goal</h3>
              <div className="muted small">
                {fmt(g.goal)} cal · {profile.goal === 'maintain' ? 'Maintain' : `${profile.goal === 'lose' ? 'Lose' : 'Gain'} ${profile.pace} lb/wk`} ·{' '}
                {ACTIVITY[profile.activity].label}
              </div>
            </div>
            <span className="chev">›</span>
          </button>
        </div>
      </section>
      <p className="note">Favorites, recipes, AI keys and backups will appear here in later stages.</p>
    </div>
  )
}
