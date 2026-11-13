import type { Macros, Unit } from '../data/types.ts'

export type Confidence = 'high' | 'medium' | 'low'
export type MatchSource = 'user' | 'dictionary' | 'fuzzy' | 'unknown' | 'ai'

export interface UserAlias {
  phrase: string
  foodId: string
}

export interface ParsedItem {
  raw: string
  query: string
  foodId: string | null
  name: string
  qty: number
  unit: Unit
  grams: number
  kcal: number
  macros: Macros
  confidence: Confidence
  alternatives: string[]
  note?: string
  source: MatchSource
}
