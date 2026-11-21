import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getKV, requestPersistence, type Profile } from './db'
import { computeGoal } from './lib/calc'
import { goalForDate, type GoalPoint } from './lib/goals'
import { todayISO } from './lib/dates'
import TabBar, { type Tab } from './components/TabBar'
import GoalSetup from './screens/GoalSetup'
import InstallGuide from './screens/InstallGuide'
import DayView from './screens/DayView'
import History from './screens/History'
import More from './screens/More'
import Favorites from './screens/Favorites'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

export default function App() {
  // `undefined` while loading, `null` when there's no profile yet.
  const profile = useLiveQuery(async () => ((await db.kv.get('profile'))?.value as Profile | undefined) ?? null)
  const goalHistory = useLiveQuery(() => getKV<GoalPoint[]>('goalHistory'))
  const [tab, setTab] = useState<Tab>('today')
  const [editingGoal, setEditingGoal] = useState(false)
  const [skipInstall, setSkipInstall] = useState(false)
  const [today, setToday] = useState(todayISO())
  const [todayTabDate, setTodayTabDate] = useState(today)
  const [historyDay, setHistoryDay] = useState<string | null>(null)
  const [moreView, setMoreView] = useState<'favorites' | null>(null)

  useEffect(() => {
    requestPersistence()
    // If the app is left open overnight, roll over to the new day when it comes back.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const t = todayISO()
      setToday((prev) => {
        if (prev !== t) setTodayTabDate((cur) => (cur === prev ? t : cur))
        return t
      })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, editingGoal, historyDay, moreView])

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

  const currentGoal = computeGoal(profile).goal
  const goalOn = (d: string) => goalForDate(goalHistory, d, currentGoal)

  const switchTab = (t: Tab) => {
    if (t === tab && t === 'today') setTodayTabDate(today) // tapping Today again jumps back to today
    if (t === 'history') setHistoryDay(null)
    if (t === 'more') setMoreView(null)
    setTab(t)
  }

  return (
    <div className="app">
      {tab === 'today' && (
        <DayView
          key={todayTabDate}
          date={todayTabDate}
          goal={goalOn(todayTabDate)}
          onChangeDate={(d) => setTodayTabDate(d > today ? today : d)}
        />
      )}
      {tab === 'history' &&
        (historyDay ? (
          <DayView
            key={historyDay}
            date={historyDay}
            goal={goalOn(historyDay)}
            onBack={() => setHistoryDay(null)}
            onChangeDate={(d) => setHistoryDay(d > today ? today : d)}
          />
        ) : (
          <History goalHistory={goalHistory} fallbackGoal={currentGoal} onOpenDay={setHistoryDay} />
        ))}
      {tab === 'weight' && <Placeholder title="Weight" stage="e" />}
      {tab === 'more' &&
        (moreView === 'favorites' ? (
          <Favorites onBack={() => setMoreView(null)} />
        ) : (
          <More profile={profile} onEditGoal={() => setEditingGoal(true)} onOpenFavorites={() => setMoreView('favorites')} />
        ))}
      <TabBar tab={tab} onChange={switchTab} />
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
