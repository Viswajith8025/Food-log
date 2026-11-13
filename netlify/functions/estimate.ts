import { estimateFragments } from '../../src/parser/estimateCore.ts'

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  try {
    const body = (await req.json()) as { fragments?: unknown }
    const fragments = Array.isArray(body.fragments) ? body.fragments.filter((item): item is string => typeof item === 'string') : []
    const estimates = await estimateFragments(fragments, {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    })
    return Response.json({ estimates })
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
}
