import Fuse from 'fuse.js'
import { foods } from './foods.ts'
import type { Food } from './types.ts'
import { normalize } from '../parser/normalize.ts'

export interface AliasRecord {
  foodId: string
  alias: string
}

const byId = new Map(foods.map((food) => [food.id, food]))

export function getFood(id: string | null | undefined): Food | undefined {
  if (!id) return undefined
  return byId.get(id)
}

export function aliasStrings(food: Food): string[] {
  return [...new Set([food.name, ...food.aliases])]
}

export function aliasClashes(): string[] {
  const seen = new Map<string, string>()
  const clashes: string[] = []
  for (const food of foods) {
    for (const alias of aliasStrings(food)) {
      const key = normalize(alias)
      if (!key) continue
      const prev = seen.get(key)
      if (prev && prev !== food.id) clashes.push(`${key}: ${prev} vs ${food.id}`)
      else seen.set(key, food.id)
    }
  }
  return clashes
}

const records: AliasRecord[] = foods.flatMap((food) =>
  aliasStrings(food).map((alias) => ({ foodId: food.id, alias: normalize(alias) })),
)

const exactAll = new Map<string, string>()
for (const record of records) {
  if (!exactAll.has(record.alias)) exactAll.set(record.alias, record.foodId)
}

const exactSingle = new Map<string, string>()
for (const [alias, foodId] of exactAll) {
  if (!alias.includes(' ')) exactSingle.set(alias, foodId)
}

export function exactFoodId(phrase: string): string | undefined {
  return exactAll.get(phrase)
}

export function exactSingleFoodId(word: string): string | undefined {
  return exactSingle.get(word)
}

export interface DishPhrase {
  phrase: string
  foodId: string
}

const phrases: DishPhrase[] = records
  .filter((record) => record.alias.includes(' '))
  .map((record) => ({ phrase: record.alias, foodId: record.foodId }))
  .sort((a, b) => b.phrase.length - a.phrase.length)

export function dishPhrases(): DishPhrase[] {
  return phrases
}

const fuse = new Fuse(records, {
  keys: ['alias'],
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.4,
  minMatchCharLength: 2,
  distance: 80,
})

export function fuzzyFood(query: string): { foodId: string; score: number } | null {
  const q = normalize(query)
  if (q.length < 3) return null
  const hit = fuse.search(q)[0]
  if (!hit || hit.score == null || hit.score > 0.35) return null
  return { foodId: hit.item.foodId, score: hit.score }
}

const CURATED: Record<string, string[]> = {
  'mixed-veg-sabzi': ['bhindi-fry', 'aloo-sabzi', 'aloo-gobi', 'baingan-bharta', 'gobi-masala', 'palak-sabzi'],
  'chicken-biryani': ['veg-biryani', 'egg-biryani', 'mutton-biryani'],
  'dal-tadka': ['moong-dal', 'masoor-dal', 'toor-dal', 'dal-makhani', 'sambar'],
  'boiled-egg': ['omelette', 'egg-bhurji', 'egg-curry', 'fried-egg'],
  dosa: ['masala-dosa', 'onion-dosa', 'rava-dosa'],
  roti: ['naan', 'paratha', 'missi-roti', 'thepla'],
  salad: ['raita', 'mixed-veg-sabzi'],
  'paneer-sabzi': ['paneer-butter-masala', 'palak-paneer', 'kadai-paneer', 'matar-paneer'],
  'chicken-curry': ['butter-chicken', 'chicken-tikka-masala', 'chicken-biryani'],
  'veg-momos': ['chicken-momos'],
  rice: ['jeera-rice', 'dal-chawal', 'veg-pulao'],
  chole: ['chole-bhature', 'rajma'],
  rajma: ['rajma-chawal', 'chole'],
}

export function alternativesFor(foodId: string, query: string): string[] {
  const out: string[] = []
  const push = (id: string) => {
    if (id !== foodId && getFood(id) && !out.includes(id)) out.push(id)
  }
  for (const id of CURATED[foodId] ?? []) push(id)
  const q = normalize(query)
  if (q) {
    for (const hit of fuse.search(q)) push(hit.item.foodId)
  }
  if (out.length < 4) {
    const food = getFood(foodId)
    if (food) {
      for (const other of foods) {
        if (other.category === food.category) push(other.id)
        if (out.length >= 6) break
      }
    }
  }
  return out.slice(0, 6)
}

export function searchFoods(query: string, limit = 20): Food[] {
  const q = normalize(query)
  if (!q) return foods.slice(0, limit)
  const ranked: { food: Food; rank: number }[] = []
  const seen = new Set<string>()
  const add = (food: Food, rank: number) => {
    if (seen.has(food.id)) return
    seen.add(food.id)
    ranked.push({ food, rank })
  }
  for (const food of foods) {
    const aliases = aliasStrings(food).map((alias) => normalize(alias))
    if (aliases.some((alias) => alias === q)) add(food, 400)
    else if (aliases.some((alias) => alias.startsWith(q))) add(food, 300)
    else if (aliases.some((alias) => alias.includes(q))) add(food, 200)
  }
  for (const hit of fuse.search(q)) {
    const food = getFood(hit.item.foodId)
    if (food) add(food, 100 - (hit.score ?? 1) * 100)
  }
  ranked.sort((a, b) => b.rank - a.rank)
  return ranked.slice(0, limit).map((row) => row.food)
}

export { foods }
