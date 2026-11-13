import { describe, expect, it } from 'vitest'
import { formatMealTime, mealSlot } from './when.ts'

describe('meal time', () => {
  it('labels the part of the day from the clock', () => {
    expect(mealSlot(new Date(2026, 10, 13, 8, 40))).toBe('Breakfast')
    expect(mealSlot(new Date(2026, 10, 13, 13, 5))).toBe('Lunch')
    expect(mealSlot(new Date(2026, 10, 13, 17, 0))).toBe('Snack')
    expect(mealSlot(new Date(2026, 10, 13, 20, 15))).toBe('Dinner')
  })

  it('prints a short clock time', () => {
    expect(formatMealTime(new Date(2026, 10, 13, 8, 40))).toBe('8:40am')
  })
})
