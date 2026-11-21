import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, requestPersistence, type Profile } from './db'
import TabBar, { type Tab } from './components/TabBar'
import GoalSetup from './screens/GoalSetup'
import InstallGuide from './screens/InstallGuide'
import Today from './screens/Today'
import More from './screens/More'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

export default function App() {
  // `undefined` while loading, `null` when there's no profile yet.
  const profile = useLiveQuery(async () => ((await db.kv.get('profile'))?.value as Profile | undefined) ?? null)
  const [tab, setTab] = useState<Tab>('today')
  const [editingGoal, setEditingGoal] = useState(false)
  const [skipInstall, setSkipInstall] = useState(false)

  useEffect(() => {
    requestPersistence()
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, editingGoal])

  if (profile === undefined) return <div className="app" />

  if (profile === null) {
    if (isIOS() && !isStandalone() && !skipInstall) {
      return (
        <div className="app">
          <InstallGuide onSkip={() => setSkipInstall(true)} />
        </div>
      )
    }
    return (
      <div className="app" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
        <GoalSetup firstRun onDone={() => setTab('today')} />
      </div>
    )
  }

  if (editingGoal) {
    return (
      <div className="app" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
        <GoalSetup initial={profile} onDone={() => setEditingGoal(false)} />
      </div>
    )
  }

  return (
    <div className="app">
      {tab === 'today' && <Today profile={profile} />}
      {tab === 'history' && <Placeholder title="History" stage="b" />}
      {tab === 'weight' && <Placeholder title="Weight" stage="e" />}
      {tab === 'more' && <More profile={profile} onEditGoal={() => setEditingGoal(true)} />}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}

function Placeholder({ title, stage }: { title: string; stage: string }) {
  return (
    <div className="screen fade-in">
      <div className="header">
        <h1>{title}</h1>
      </div>
      <section className="card flat muted small">Coming in stage ({stage}).</section>
    </div>
  )
}
