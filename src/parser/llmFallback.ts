import { normalize } from './normalize.ts'
import type { ParsedItem } from './types.ts'

export interface AiEstimate {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  confidence: number | string
}

export interface LlmCache {
  get(key: string): Promise<AiEstimate | undefined>
  set(key: string, value: AiEstimate): Promise<void>
}

function needsModel(item: ParsedItem): boolean {
  return item.foodId == null || item.confidence === 'low'
}

function fragmentOf(item: ParsedItem): string {
  return (item.raw || item.query || item.name).trim()
}

function asEstimate(value: unknown): AiEstimate | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
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
  return {
    ...item,
    foodId: null,
    name: estimate.name,
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
  }
}

function failed(item: ParsedItem): ParsedItem {
  if (item.foodId) return item
  return { ...item, name: 'Unknown — tap to fix', confidence: 'low', source: 'unknown' }
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
