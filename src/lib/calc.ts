import type { Activity, GoalType, Profile, Sex } from '../db'

export const ACTIVITY: Record<Activity, { label: string; hint: string; factor: number }> = {
  sedentary: { label: 'Sedentary', hint: 'Mostly sitting, little exercise', factor: 1.2 },
  light: { label: 'Lightly active', hint: 'Light exercise 1–3 days a week', factor: 1.375 },
  moderate: { label: 'Moderately active', hint: 'Exercise 3–5 days a week', factor: 1.55 },
  very: { label: 'Very active', hint: 'Hard exercise 6–7 days a week', factor: 1.725 },
  extra: { label: 'Extra active', hint: 'Physical job plus training', factor: 1.9 },
}

/** 1 lb of body weight ≈ 3,500 calories, so 1 lb/week ≈ 500/day. */
export const PACES: Record<Exclude<GoalType, 'maintain'>, { lbPerWeek: number; label: string }[]> = {
  lose: [
    { lbPerWeek: 0.5, label: 'Gentle — ½ lb a week' },
    { lbPerWeek: 1, label: 'Steady — 1 lb a week' },
    { lbPerWeek: 1.5, label: 'Faster — 1½ lb a week' },
  ],
  gain: [
    { lbPerWeek: 0.6, label: 'Steady — about ½ lb a week' },
    { lbPerWeek: 1, label: 'Faster — 1 lb a week' },
  ],
}

export const defaultPace = (goal: GoalType) => (goal === 'lose' ? 1 : goal === 'gain' ? 0.6 : 0)

export const SAFE_MIN: Record<Sex, number> = { female: 1200, male: 1500 }

export const lbToKg = (lb: number) => lb * 0.45359237
export const inToCm = (inches: number) => inches * 2.54

export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightFt' | 'heightIn' | 'weightLb'>) {
  const kg = lbToKg(p.weightLb)
  const cm = inToCm(p.heightFt * 12 + p.heightIn)
  // Mifflin-St Jeor
  return 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'male' ? 5 : -161)
}

export interface GoalResult {
  bmr: number
  tdee: number
  adjustment: number
  calculated: number
  /** The goal actually used: calculated (or custom), never below the safe minimum. */
  goal: number
  floor: number
  hitFloor: boolean
  usingCustom: boolean
}

const round10 = (n: number) => Math.round(n / 10) * 10

export function computeGoal(p: Profile): GoalResult {
  const b = bmr(p)
  const tdee = b * ACTIVITY[p.activity].factor
  const perDay = p.pace * 500
  const adjustment = p.goal === 'lose' ? -perDay : p.goal === 'gain' ? perDay : 0
  const calculated = round10(tdee + adjustment)
  const floor = SAFE_MIN[p.sex]
  const wanted = p.customGoal && p.customGoal > 0 ? round10(p.customGoal) : calculated
  return {
    bmr: Math.round(b),
    tdee: round10(tdee),
    adjustment: Math.round(adjustment),
    calculated,
    goal: Math.max(wanted, floor),
    floor,
    hitFloor: wanted < floor,
    usingCustom: !!(p.customGoal && p.customGoal > 0),
  }
}

/** Is the profile's weight far enough from the latest logged weight to suggest a recalculation? */
export function weightDrifted(profileLb: number, latestLb: number) {
  return Math.abs(profileLb - latestLb) >= 5
}
