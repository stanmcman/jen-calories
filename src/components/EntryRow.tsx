import type { Entry } from '../db'
import { fmt, todayISO } from '../lib/dates'
import { useObjectURL } from '../lib/useObjectURL'

export default function EntryRow({ entry, onClick }: { entry: Entry; onClick: () => void }) {
  const photo = useObjectURL(entry.photo)
  // Only show the time if it was logged on the same day (back-dated entries don't have a meaningful time).
  const created = new Date(entry.createdAt)
  const time =
    todayISO(created) === entry.date ? created.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null
  const macros =
    entry.protein !== undefined || entry.carbs !== undefined || entry.fat !== undefined
      ? `P ${entry.protein ?? '–'} · C ${entry.carbs ?? '–'} · F ${entry.fat ?? '–'}`
      : null
  return (
    <button className="list-item entry" onClick={onClick}>
      {photo && <img className="entry-thumb" src={photo} alt="" />}
      <span className="grow">
        <span className="entry-desc">{entry.description}</span>
        {(time || macros) && <span className="entry-meta">{[time, macros].filter(Boolean).join(' · ')}</span>}
      </span>
      <span className="num entry-cal">{fmt(entry.calories)}</span>
    </button>
  )
}
