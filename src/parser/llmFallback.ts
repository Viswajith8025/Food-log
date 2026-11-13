import { searchFoods } from '../data/search.ts'
import { normalize } from './normalize.ts'
import { worthAsking } from './parse.ts'
import type { ParsedItem } from './types.ts'

export interface AiEstimate {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  confidence: number | string
  unknown?: boolean
}

export interface LlmCache {
  get(key: string): Promise<AiEstimate | undefined>
  set(key: string, value: AiEstimate): Promise<void>
}

function needsModel(item: ParsedItem): boolean {
  if (item.askModel === false) return false
  const fragment = (item.raw || item.query || item.name).trim()
  if (!worthAsking(fragment)) return false
  return item.foodId == null || item.confidence === 'low'
}

/** Keep the words the person actually said when the model invents a variant. */
export function genericAiName(fragment: string, aiName: string): string {
  const said = normalize(fragment).split(/\s+/).filter((word) => word.length >= 3 && !/^\d/.test(word))
  const parts = aiName.split(/\s+/).filter(Boolean)
  const mentioned = said.some((word) => parts.some((part) => part.toLowerCase() === word || part.toLowerCase().includes(word)))
  if (!mentioned) return aiName
  const extra = parts.filter((part) => !said.some((word) => part.toLowerCase() === word || part.toLowerCase().includes(word)))
  if (extra.length === 0 || said.length === 0) return aiName
  return said.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function fragmentOf(item: ParsedItem): string {
  return (item.raw || item.query || item.name).trim()
}

function asEstimate(value: unknown): AiEstimate | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (row.unknown === true) return { name: '', grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, confidence: 0, unknown: true }
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  const grams = Number(row.grams)
  const kcal = Number(row.kcal)
  const protein = Number(row.protein)
  const carbs = Number(row.carbs)
  const fat = Number(row.fat)
  if (!name || [grams, kcal, protein, carbs, fat].some((n) => !Number.isFinite(n) || n < 0)) return null
  const confidence = typeof row.confidence === 'number' || typeof row.confidence === 'string' ? row.confidence : 0.4
  return { name, grams, kcal, protein, carbs, fat, confidence }
}

function applyEstimate(item: ParsedItem, estimate: AiEstimate): ParsedItem {
  if (estimate.unknown) {
    return { ...item, foodId: null, name: 'Not recognised - tap to pick', confidence: 'low', source: 'unknown', askModel: false, kcal: 0, grams: 0 }
  }
  const fragment = fragmentOf(item)
  const name = genericAiName(fragment, estimate.name)
  const alternatives = searchFoods(fragment, 5).map((food) => food.id)
  return {
    ...item,
    foodId: null,
    name,
    grams: Math.round(estimate.grams),
    kcal: Math.round(estimate.kcal),
    macros: {
      protein: Math.round(estimate.protein * 10) / 10,
      carbs: Math.round(estimate.carbs * 10) / 10,
      fat: Math.round(estimate.fat * 10) / 10,
    },
    confidence: 'low',
    source: 'ai',
    note: undefined,
    alternatives: alternatives.length ? alternatives : item.alternatives,
  }
}

function failed(item: ParsedItem): ParsedItem {
  if (item.foodId) return item
  return { ...item, name: 'Not recognised - tap to pick', confidence: 'low', source: 'unknown' }
}

/**
 * Asks a model only about fragments the dictionary could not place.
 * One timeout covers the whole request. A miss still leaves the other items intact.
 */
export async function applyLlmFallback(
  items: ParsedItem[],
  options: {
    cache: LlmCache
    endpoint?: string
    fetchImpl?: typeof fetch
    timeoutMs?: number
  },
): Promise<ParsedItem[]> {
  const endpoint = options.endpoint ?? '/api/estimate'
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 3000
  const next = items.slice()
  const pending: { index: number; key: string; fragment: string }[] = []

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (!needsModel(item)) continue
    const fragment = fragmentOf(item)
    const key = normalize(fragment)
    if (!key) {
      next[index] = failed(item)
      continue
    }
    const cached = await options.cache.get(key)
    if (cached) {
      next[index] = applyEstimate(item, cached)
      continue
    }
    pending.push({ index, key, fragment })
  }

  if (pending.length === 0) return next

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fragments: pending.map((row) => row.fragment) }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('estimate failed')
    const body = (await response.json()) as { estimates?: unknown[] }
    const estimates = Array.isArray(body.estimates) ? body.estimates : []
    for (let i = 0; i < pending.length; i += 1) {
      const row = pending[i]
      const estimate = asEstimate(estimates[i])
      if (!estimate) {
        next[row.index] = failed(items[row.index])
        continue
      }
      await options.cache.set(row.key, estimate)
      next[row.index] = applyEstimate(items[row.index], estimate)
    }
  } catch {
    for (const row of pending) next[row.index] = failed(items[row.index])
  } finally {
    clearTimeout(timer)
  }
  return next
}
