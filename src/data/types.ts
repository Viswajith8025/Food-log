export type Unit =
  | 'piece'
  | 'katori'
  | 'plate'
  | 'glass'
  | 'bowl'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'slice'
  | 'pack'
  | 'g'
  | 'ml'

export type ServingUnit = Exclude<Unit, 'g' | 'ml'>

export interface Macros {
  protein: number
  carbs: number
  fat: number
}

export interface Food {
  id: string
  name: string
  aliases: string[]
  category: string
  /** Per 100g as eaten, except Maggi which is per 100g dry. */
  per100g: { kcal: number } & Macros
  servings: Partial<Record<ServingUnit, number>>
  defaultServing: { qty: number; unit: ServingUnit }
  source: string
  note?: string
  /** Exact match is only a best guess. Show it as medium confidence. */
  generic?: boolean
}
