import type { AiEstimate } from './llmFallback.ts'

const PROMPT = `You estimate what someone in India just ate.
Return JSON only: {"estimates":[{"name":"string","grams":number,"kcal":number,"protein":number,"carbs":number,"fat":number,"confidence":number}]}
One object per fragment, same order.
grams, kcal, protein, carbs, and fat are for the portion they described, not per 100g.
If they gave no amount, use one typical home serving.
Prefer Indian home cooking. confidence is 0 to 1.
If the fragment is not food, still return a best effort with confidence under 0.3.`

function stripFence(text: string): string {
  return text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
}

export function parseEstimatePayload(text: string, count: number): AiEstimate[] {
  const parsed = JSON.parse(stripFence(text)) as { estimates?: unknown[] }
  const rows = Array.isArray(parsed.estimates) ? parsed.estimates : []
  return Array.from({ length: count }, (_, index) => {
    const row = rows[index]
    if (!row || typeof row !== 'object') {
      return { name: 'Unknown food', grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, confidence: 0 }
    }
    const value = row as Record<string, unknown>
    return {
      name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Unknown food',
      grams: Number(value.grams) || 0,
      kcal: Number(value.kcal) || 0,
      protein: Number(value.protein) || 0,
      carbs: Number(value.carbs) || 0,
      fat: Number(value.fat) || 0,
      confidence: typeof value.confidence === 'number' ? value.confidence : 0.4,
    }
  })
}

// New API keys are refused on Gemini 2.5 Flash (HTTP 404). 3.5 Flash-Lite is the
// cheap model those keys can call. Older keys still get 2.5 if the new id 404s.
const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']

async function gemini(fragments: string[], key: string, model: string): Promise<AiEstimate[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${PROMPT}\n\nFragments:\n${fragments.map((fragment, i) => `${i + 1}. ${fragment}`).join('\n')}` }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    },
  )
  if (!response.ok) throw new Error(`gemini ${response.status}`)
  const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
  return parseEstimatePayload(text, fragments.length)
}

async function openAi(fragments: string[], key: string): Promise<AiEstimate[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: fragments.map((fragment, i) => `${i + 1}. ${fragment}`).join('\n') },
      ],
    }),
  })
  if (!response.ok) throw new Error(`openai ${response.status}`)
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  return parseEstimatePayload(body.choices?.[0]?.message?.content ?? '', fragments.length)
}

export async function estimateFragments(fragments: string[], env: { GEMINI_API_KEY?: string; OPENAI_API_KEY?: string }): Promise<AiEstimate[]> {
  const clean = fragments.map((fragment) => fragment.trim()).filter(Boolean).slice(0, 8)
  if (clean.length === 0) return []
  if (env.GEMINI_API_KEY) {
    let last: Error | null = null
    for (const model of GEMINI_MODELS) {
      try {
        return await gemini(clean, env.GEMINI_API_KEY, model)
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (!message.includes('404')) throw error
        last = error instanceof Error ? error : new Error(message)
      }
    }
    throw last ?? new Error('gemini unavailable')
  }
  if (env.OPENAI_API_KEY) return openAi(clean, env.OPENAI_API_KEY)
  throw new Error('no model key')
}
