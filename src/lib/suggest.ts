import type { Entry, Favorite, Recipe } from '../db'

export interface Suggestion {
  key: string
  description: string
  calories: number
  protein?: number
  carbs?: number
  fat?: number
  favorite: boolean
  recipe?: boolean
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** Every word she's typed must appear somewhere in the food's description. */
function matches(desc: string, words: string[]) {
  const d = norm(desc)
  return words.every((w) => d.includes(w))
}

/** Favorites first, then recent foods (newest first), no duplicates. */
export function suggest(query: string, favorites: Favorite[], recents: Entry[], limit = 5, recipes: Recipe[] = []): Suggestion[] {
  const words = norm(query).split(' ').filter(Boolean)
  if (!words.length || norm(query).length < 2) return []
  const seen = new Set<string>()
  const out: Suggestion[] = []
  const push = (s: Omit<Suggestion, 'key'>) => {
    const k = norm(s.description)
    if (seen.has(k) || !matches(s.description, words)) return
    seen.add(k)
    out.push({ ...s, key: k })
  }
  for (const r of recipes)
    push({
      description: `${r.name} (1 serving)`,
      calories: Math.round(r.totalCalories / Math.max(r.servings, 1)),
      favorite: false,
      recipe: true,
    })
  for (const f of favorites) push({ ...pick(f), favorite: true })
  for (const e of recents) push({ ...pick(e), favorite: false })
  // An exact match to what's already typed isn't a useful suggestion.
  return out.filter((s) => s.key !== norm(query)).slice(0, limit)
}

function pick(x: Entry | Favorite) {
  return { description: x.description, calories: x.calories, protein: x.protein, carbs: x.carbs, fat: x.fat }
}

export const sameFood = (a: string, b: string) => norm(a) === norm(b)
