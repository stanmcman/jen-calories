// Backup = one JSON file with everything (photos included), minus API keys.
import { db, getKV, setKV, type Entry } from '../db'

const FORMAT = 'nibbles-and-bits-backup'
const VERSION = 1
/** Secrets stay on the phone; she re-enters them after a restore. */
const NOT_BACKED_UP = new Set(['anthropicKey', 'usdaKey'])

function blobToDataURL(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })
}

async function dataURLToBlob(u: string) {
  return (await fetch(u)).blob()
}

export async function buildBackup(): Promise<{ blob: Blob; filename: string; counts: Record<string, number> }> {
  const [entries, favorites, recipes, weights, kv] = await Promise.all([
    db.entries.toArray(),
    db.favorites.toArray(),
    db.recipes.toArray(),
    db.weights.toArray(),
    db.kv.toArray(),
  ])
  const entriesOut = await Promise.all(
    entries.map(async (e) => ({ ...e, photo: e.photo ? await blobToDataURL(e.photo) : undefined })),
  )
  const data = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    entries: entriesOut,
    favorites,
    recipes,
    weights,
    settings: kv.filter((r) => !NOT_BACKED_UP.has(r.key) && r.key !== 'lastBackup'),
  }
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return {
    blob: new Blob([JSON.stringify(data)], { type: 'application/json' }),
    filename: `nibbles-backup-${stamp}.json`,
    counts: { entries: entries.length, favorites: favorites.length, recipes: recipes.length, weights: weights.length },
  }
}

/** Hand the file to iOS's share sheet (Save to Files, AirDrop, Mail…), or download it elsewhere. */
export async function saveBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const { blob, filename } = await buildBackup()
  const file = new File([blob], filename, { type: 'application/json' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Nibbles & Bits backup' })
      await setKV('lastBackup', Date.now())
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // fall through to a plain download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  await setKV('lastBackup', Date.now())
  return 'downloaded'
}

export interface ParsedBackup {
  exportedAt: string
  counts: Record<string, number>
  restore: () => Promise<void>
}

/** Read and check a backup file. Nothing changes until `restore()` is called. */
export async function readBackup(file: File): Promise<ParsedBackup> {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't a Nibbles & Bits backup.")
  }
  if (data?.format !== FORMAT || typeof data.version !== 'number') throw new Error("That file isn't a Nibbles & Bits backup.")
  if (data.version > VERSION) throw new Error('This backup was made by a newer version of the app. Update the app and try again.')
  const arr = (k: string) => (Array.isArray(data[k]) ? (data[k] as Record<string, unknown>[]) : [])
  const entries = arr('entries')
  const favorites = arr('favorites')
  const recipes = arr('recipes')
  const weights = arr('weights')
  const settings = arr('settings')
  return {
    exportedAt: String(data.exportedAt ?? ''),
    counts: { entries: entries.length, favorites: favorites.length, recipes: recipes.length, weights: weights.length },
    restore: async () => {
      const entriesIn = await Promise.all(
        entries.map(async (e) => ({
          ...(e as unknown as Entry),
          photo: typeof e.photo === 'string' ? await dataURLToBlob(e.photo) : undefined,
        })),
      )
      // Keep this phone's API keys; replace everything else.
      const keep = (await db.kv.toArray()).filter((r) => NOT_BACKED_UP.has(r.key))
      await db.transaction('rw', [db.entries, db.favorites, db.recipes, db.weights, db.kv], async () => {
        await Promise.all([db.entries.clear(), db.favorites.clear(), db.recipes.clear(), db.weights.clear(), db.kv.clear()])
        await db.entries.bulkAdd(entriesIn)
        await db.favorites.bulkAdd(favorites as never[])
        await db.recipes.bulkAdd(recipes as never[])
        await db.weights.bulkAdd(weights as never[])
        await db.kv.bulkPut([...(settings as never[]), ...keep])
      })
      await setKV('lastBackup', Date.now())
    },
  }
}

export const REMIND_AFTER_DAYS = 14

/** Days since the last backup, or since she started using the app if she's never backed up. */
export async function daysSinceBackup() {
  const last = await getKV<number>('lastBackup')
  const since = last ?? (await db.entries.orderBy('createdAt').first())?.createdAt
  if (!since) return 0
  return Math.floor((Date.now() - since) / 86_400_000)
}
