// Everything Nibbles & Bits knows is stored here, on the phone, in IndexedDB.
import Dexie, { type EntityTable } from 'dexie'

export type Sex = 'female' | 'male'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra'
export type GoalType = 'lose' | 'maintain' | 'gain'
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Profile {
  sex: Sex
  age: number
  heightFt: number
  heightIn: number
  weightLb: number
  activity: Activity
  goal: GoalType
  /** lb per week for lose/gain */
  pace: number
  goalWeightLb?: number
  /** If set, overrides the calculated goal (never below the safe minimum). */
  customGoal?: number
  updatedAt: number
}

export interface Entry {
  id?: number
  date: string // YYYY-MM-DD (local)
  meal: Meal
  description: string
  calories: number
  protein?: number
  carbs?: number
  fat?: number
  source: 'manual' | 'ai-text' | 'ai-photo' | 'favorite' | 'recipe' | 'barcode' | 'search'
  /** Small compressed copy of the meal photo (JPEG), kept with the entry for History. */
  photo?: Blob
  createdAt: number
}

export interface Favorite {
  id?: number
  description: string
  calories: number
  protein?: number
  carbs?: number
  fat?: number
  meal: Meal
  createdAt: number
}

export interface Ingredient {
  name: string
  amount: string
  calories: number
}

export interface Recipe {
  id?: number
  name: string
  servings: number
  ingredients: Ingredient[]
  totalCalories: number
  createdAt: number
}

export interface WeightLog {
  id?: number
  date: string
  weightLb: number
}

export interface KV {
  key: string
  value: unknown
}

export const db = new Dexie('nibbles') as Dexie & {
  entries: EntityTable<Entry, 'id'>
  favorites: EntityTable<Favorite, 'id'>
  recipes: EntityTable<Recipe, 'id'>
  weights: EntityTable<WeightLog, 'id'>
  kv: EntityTable<KV, 'key'>
}

db.version(1).stores({
  entries: '++id, date, meal, createdAt',
  favorites: '++id, description, createdAt',
  recipes: '++id, name, createdAt',
  weights: '++id, date',
  kv: 'key',
})

export async function getKV<T>(key: string): Promise<T | undefined> {
  const row = await db.kv.get(key)
  return row?.value as T | undefined
}

export async function setKV(key: string, value: unknown) {
  await db.kv.put({ key, value })
}

/** Ask iOS/Safari not to clear our storage. Installed home-screen apps usually get this. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    /* not supported — fine */
  }
}
