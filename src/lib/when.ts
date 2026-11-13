export type MealSlot = 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner'

export function mealSlot(when: Date): MealSlot {
  const hour = when.getHours()
  if (hour >= 5 && hour < 11) return 'Breakfast'
  if (hour >= 11 && hour < 16) return 'Lunch'
  if (hour >= 16 && hour < 19) return 'Snack'
  return 'Dinner'
}

export function formatMealTime(when: Date): string {
  const minute = String(when.getMinutes()).padStart(2, '0')
  const suffix = when.getHours() >= 12 ? 'pm' : 'am'
  const hour = when.getHours() % 12 || 12
  return `${hour}:${minute}${suffix}`
}
