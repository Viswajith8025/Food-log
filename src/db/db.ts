import Dexie, { type EntityTable } from 'dexie'
import type { ParsedItem } from '../parser/types.ts'

export interface Meal {
  id?: number
  day: string
  text: string
  items: ParsedItem[]
  kcal: number
  protein: number
  carbs: number
  fat: number
  createdAt: number
}

export interface AliasRow {
  phrase: string
  foodId: string
  updatedAt: number
}

export interface LlmCacheRow {
  key: string
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  confidence: string
  updatedAt: number
}

const db = new Dexie('ThaliLog') as Dexie & {
  meals: EntityTable<Meal, 'id'>
  aliases: EntityTable<AliasRow, 'phrase'>
  llmCache: EntityTable<LlmCacheRow, 'key'>
}

db.version(1).stores({
  meals: '++id, day, createdAt',
  aliases: 'phrase, foodId',
  llmCache: 'key',
})

export { db }

export function dayKey(which: 'today' | 'yesterday', now = new Date()): string {
  const date = new Date(now)
  if (which === 'yesterday') date.setDate(date.getDate() - 1)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function mealsFor(day: string): Promise<Meal[]> {
  const rows = await db.meals.where('day').equals(day).toArray()
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

export async function recentMeals(limit = 8): Promise<Meal[]> {
  const rows = await db.meals.orderBy('createdAt').reverse().toArray()
  const seen = new Set<string>()
  const out: Meal[] = []
  for (const meal of rows) {
    const key = meal.text.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(meal)
    if (out.length === limit) break
  }
  return out
}
