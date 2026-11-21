import type { Profile } from '../db'
import { computeGoal } from '../lib/calc'
import { fmt, prettyDate, todayISO } from '../lib/dates'
import Ring from '../components/Ring'

export default function Today({ profile }: { profile: Profile }) {
  const goal = computeGoal(profile).goal
  const eaten = 0 // food logging arrives in stage (b)
  return (
    <div className="screen fade-in">
      <div className="header">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1>{prettyDate(todayISO())}</h1>
        </div>
      </div>
      <section className="card stack" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <Ring eaten={eaten} goal={goal} />
        <div className="row between" style={{ padding: '0 8px' }}>
          <div>
            <div className="eyebrow">Eaten</div>
            <div className="num" style={{ fontWeight: 750, fontSize: 20 }}>{fmt(eaten)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow">Goal</div>
            <div className="num" style={{ fontWeight: 750, fontSize: 20 }}>{fmt(goal)}</div>
          </div>
        </div>
      </section>
      <section className="card flat muted small">Food logging is coming in the next stage.</section>
    </div>
  )
}
