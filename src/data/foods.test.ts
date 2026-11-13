import { describe, expect, it } from 'vitest'
import { foods } from './foods.ts'
import { aliasClashes, getFood } from './search.ts'

describe('food dictionary', () => {
  it('covers a normal Indian kitchen, not a handful of examples', () => {
    expect(foods.length).toBeGreaterThanOrEqual(150)
  })

  it('keeps ids unique and aliases unambiguous', () => {
    expect(new Set(foods.map((food) => food.id)).size).toBe(foods.length)
    expect(aliasClashes()).toEqual([])
  })

  it('uses the servings people say, and a portion that can be a meal', () => {
    expect(getFood('dal-tadka')?.servings.katori).toBe(150)
    expect(getFood('mixed-veg-sabzi')?.servings.katori).toBe(150)
    expect(getFood('maggi')?.servings.pack).toBe(70)
    expect(getFood('lassi')?.servings.glass).toBe(250)
    expect(getFood('chai')?.servings.glass).toBe(250)

    for (const food of foods) {
      expect(food.source).toMatch(/IFCT|Nutrient/)
      expect(food.aliases.length).toBeGreaterThan(0)
      const grams = food.servings[food.defaultServing.unit]
      expect(grams).toBeGreaterThan(0)
      const kcal = (food.per100g.kcal * food.defaultServing.qty * (grams ?? 0)) / 100
      expect(kcal).toBeGreaterThan(0)
      expect(kcal).toBeLessThan(1200)
    }
  })
})
