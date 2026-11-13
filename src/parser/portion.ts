import { alternativesFor, getFood } from '../data/search.ts'
import type { Unit } from '../data/types.ts'
import type { ParsedItem } from './types.ts'

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10
}

export function withQtyUnit(item: ParsedItem, qty: number, unit: Unit): ParsedItem {
  const nextQty = Math.max(0.5, Math.round(qty * 2) / 2)
  const food = getFood(item.foodId)
  if (!food) {
    const ratio = item.qty > 0 ? nextQty / item.qty : 1
    return {
      ...item,
      qty: nextQty,
      unit,
      grams: Math.round(item.grams * ratio),
      kcal: Math.round(item.kcal * ratio),
      macros: {
        protein: roundMacro(item.macros.protein * ratio),
        carbs: roundMacro(item.macros.carbs * ratio),
        fat: roundMacro(item.macros.fat * ratio),
      },
    }
  }
  const usable = unit !== 'g' && food.servings[unit] != null ? unit : unit === 'g' ? 'g' : food.defaultServing.unit
  const unitGrams = usable === 'g' ? 1 : food.servings[usable] ?? 100
  const grams = Math.round(nextQty * unitGrams)
  const factor = grams / 100
  return {
    ...item,
    qty: nextQty,
    unit: usable,
    grams,
    kcal: Math.round(food.per100g.kcal * factor),
    macros: {
      protein: roundMacro(food.per100g.protein * factor),
      carbs: roundMacro(food.per100g.carbs * factor),
      fat: roundMacro(food.per100g.fat * factor),
    },
  }
}

export function withFood(item: ParsedItem, foodId: string): ParsedItem {
  const food = getFood(foodId)
  if (!food) return item
  const unit = item.unit !== 'g' && food.servings[item.unit] != null ? item.unit : food.defaultServing.unit
  const next = withQtyUnit({ ...item, foodId, source: 'user', confidence: 'high', note: undefined }, item.qty || food.defaultServing.qty, unit)
  return {
    ...next,
    foodId,
    name: food.name,
    query: item.query,
    raw: item.raw,
    source: 'user',
    confidence: 'high',
    note: undefined,
    alternatives: alternativesFor(foodId, item.query || food.name),
  }
}
