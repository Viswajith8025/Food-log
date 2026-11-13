import { describe, expect, it, vi } from 'vitest'
import { parse } from './parse.ts'
import { applyLlmFallback, type AiEstimate, type LlmCache } from './llmFallback.ts'
import type { ParsedItem } from './types.ts'

function memoryCache(): LlmCache & { size: number } {
  const store = new Map<string, AiEstimate>()
  return {
    get size() {
      return store.size
    },
    get(key) {
      return Promise.resolve(store.get(key))
    },
    set(key, value) {
      store.set(key, value)
      return Promise.resolve()
    },
  }
}

const estimate: AiEstimate = {
  name: 'Peanut chikki',
  grams: 30,
  kcal: 140,
  protein: 4,
  carbs: 16,
  fat: 7,
  confidence: 0.4,
}

describe('applyLlmFallback', () => {
  it('does not call the model for a dictionary hit', async () => {
    const fetchImpl = vi.fn()
    const items = parse('2 roti, dal')
    const result = await applyLlmFallback(items, { cache: memoryCache(), fetchImpl })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.map((item) => item.foodId)).toEqual(['roti', 'dal-tadka'])
  })

  it('sends only the unmatched fragment and caches it', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      void init
      return new Response(JSON.stringify({ estimates: [estimate] }), { status: 200 })
    })
    const cache = memoryCache()
    const items = parse('2 roti and xyz random food')
    const first = await applyLlmFallback(items, { cache, fetchImpl: fetchImpl as typeof fetch })
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as { fragments: string[] }
    expect(body.fragments).toEqual(['xyz random food'])
    expect(first[0].foodId).toBe('roti')
    expect(first[1]).toMatchObject({ name: 'Peanut chikki', kcal: 140, source: 'ai', foodId: null })

    await applyLlmFallback(items, { cache, fetchImpl: fetchImpl as typeof fetch })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('names a miss so the meal can still be saved', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 503 }))
    const items = parse('xyz random food')
    const result = await applyLlmFallback(items, { cache: memoryCache(), fetchImpl })
    expect(result[0].name).toBe('Unknown — tap to fix')
    expect(result[0].foodId).toBeNull()
  })

  it('gives up when the model is slow', async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    })
    const low: ParsedItem = {
      ...parse('maggi')[0],
      foodId: 'maggi',
      confidence: 'low',
      raw: 'magie noodles',
      query: 'magie noodles',
    }
    const result = await applyLlmFallback([low], {
      cache: memoryCache(),
      fetchImpl: fetchImpl as typeof fetch,
      timeoutMs: 20,
    })
    expect(result[0].foodId).toBe('maggi')
    expect(result[0].name).toBe('Maggi')
  })
})
