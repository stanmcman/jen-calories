import type { Meal } from '../db'

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

/** Best guess at the meal from the time of day. */
export function mealForNow(d = new Date()): Meal {
  const h = d.getHours() + d.getMinutes() / 60
  if (h >= 4 && h < 10.5) return 'breakfast'
  if (h >= 11 && h < 14.5) return 'lunch'
  if (h >= 16.5 && h < 21) return 'dinner'
  return 'snack'
}
