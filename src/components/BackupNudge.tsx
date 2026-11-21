import { useEffect, useState } from 'react'
import { getKV, setKV } from '../db'
import { daysSinceBackup, REMIND_AFTER_DAYS, saveBackup } from '../lib/backup'

/** A gentle reminder on Today when it's been two weeks or more since the last backup. */
export default function BackupNudge() {
  const [days, setDays] = useState<number | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    ;(async () => {
      const snooze = (await getKV<number>('backupSnoozeUntil')) ?? 0
      if (Date.now() < snooze) return
      const d = await daysSinceBackup()
      if (d >= REMIND_AFTER_DAYS) setDays(d)
    })()
  }, [])

  if (days === null || done) return null
  return (
    <section className="card accent stack fade-in">
      <h3>Time for a backup</h3>
      <p className="small">
        It's been {days} days. Your log lives only on this phone, so save a copy to iCloud Drive in case anything happens to
        it.
      </p>
      <div className="row">
        <button
          className="btn secondary grow"
          onClick={async () => {
            await setKV('backupSnoozeUntil', Date.now() + 3 * 86_400_000)
            setDone(true)
          }}
        >
          Later
        </button>
        <button
          className="btn grow"
          onClick={async () => {
            const r = await saveBackup()
            if (r !== 'cancelled') setDone(true)
          }}
        >
          Back up now
        </button>
      </div>
    </section>
  )
}
