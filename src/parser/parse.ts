import type { Food, Unit } from '../data/types.ts'
import {
  alternativesFor,
  dishPhrases,
  exactFoodId,
  exactSingleFoodId,
  fuzzyFood,
  getFood,
} from '../data/search.ts'
import { escapeReg, normalize } from './normalize.ts'
import type { Confidence, ParsedItem, UserAlias } from './types.ts'

const NUMBER_WORDS: Record<string, number> = {
  half: 0.5,
  aadha: 0.5,
  adha: 0.5,
  aadhi: 0.5,
  dedh: 1.5,
  derh: 1.5,
  dhai: 2.5,
  dhaai: 2.5,
  ek: 1,
  ik: 1,
  do: 2,
  teen: 3,
  tin: 3,
  char: 4,
  chaar: 4,
  paanch: 5,
  panch: 5,
  che: 6,
  chhe: 6,
  cheh: 6,
  saat: 7,
  saath: 7,
  sat: 7,
  aath: 8,
  aat: 8,
  nau: 9,
  das: 10,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  quarter: 0.25,
}

const UNITS: Record<string, Unit> = {
  katori: 'katori',
  katoris: 'katori',
  plate: 'plate',
  plates: 'plate',
  bowl: 'bowl',
  bowls: 'bowl',
  glass: 'glass',
  glasses: 'glass',
  cup: 'cup',
  cups: 'cup',
  piece: 'piece',
  pieces: 'piece',
  pc: 'piece',
  pcs: 'piece',
  spoon: 'tbsp',
  spoons: 'tbsp',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  slice: 'slice',
  slices: 'slice',
  pack: 'pack',
  packs: 'pack',
  packet: 'pack',
  packets: 'pack',
  g: 'g',
  gm: 'g',
  gms: 'g',
  gram: 'g',
  grams: 'g',
}

const FILLERS = new Set(['of', 'a', 'an', 'the', 'some', 'thoda', 'thodi', 'little', 'please', 'just', 'only', 'and', 'aur', 'with', 'n'])
const EGG_WORDS = new Set(['egg', 'eggs', 'anda'])

interface Classified {
  kind: 'food' | 'num' | 'unit' | 'word'
  text: string
  foodId?: string
  phrase?: string
  user?: boolean
  num?: number
  unit?: Unit
  egg?: boolean
}

function parseNumber(token: string): number | null {
  if (token in NUMBER_WORDS) return NUMBER_WORDS[token]
  if (token.includes('/')) {
    const [a, b] = token.split('/').map((part) => Number(part.trim()))
    if (Number.isFinite(a) && b) return a / b
  }
  const value = Number(token)
  return Number.isFinite(value) ? value : null
}

function resolveWord(word: string, userAliases: UserAlias[]): { foodId: string; user: boolean } | null {
  const user = userAliases.find((alias) => normalize(alias.phrase) === word && getFood(alias.foodId))
  if (user) return { foodId: user.foodId, user: true }
  const stemmed = word.endsWith('s') ? exactSingleFoodId(word.slice(0, -1)) : undefined
  const id = exactSingleFoodId(word) ?? stemmed
  if (id) return { foodId: id, user: false }
  return null
}

function protect(text: string, userAliases: UserAlias[]): string {
  const phrases: { phrase: string; token: string }[] = []
  for (const alias of userAliases) {
    const phrase = normalize(alias.phrase)
    if (phrase.split(' ').length >= 2 && getFood(alias.foodId)) {
      phrases.push({
        phrase,
        token: `«u:${alias.foodId}|${phrase.replaceAll(' ', '_')}»`,
      })
    }
  }
  for (const dish of dishPhrases()) {
    phrases.push({
      phrase: dish.phrase,
      token: `«${dish.foodId}|${dish.phrase.replaceAll(' ', '_')}»`,
    })
  }
  phrases.sort((a, b) => {
    const byLength = b.phrase.length - a.phrase.length
    if (byLength !== 0) return byLength
    return Number(b.token.startsWith('«u:')) - Number(a.token.startsWith('«u:'))
  })

  let out = text
  for (const { phrase, token } of phrases) {
    const re = new RegExp(`\\b${escapeReg(phrase)}\\b`, 'g')
    out = out.replace(re, (match, offset: number) => {
      const before = out.slice(0, offset)
      if (before.lastIndexOf('«') > before.lastIndexOf('»')) return match
      return token
    })
  }
  return out
}

function readFoodToken(token: string): { foodId: string; phrase: string; user: boolean } | null {
  if (!token.startsWith('«') || !token.endsWith('»')) return null
  const body = token.slice(1, -1)
  const pipe = body.indexOf('|')
  const idPart = pipe === -1 ? body : body.slice(0, pipe)
  const phrase = pipe === -1 ? idPart : body.slice(pipe + 1).replaceAll('_', ' ')
  const user = idPart.startsWith('u:')
  return { foodId: user ? idPart.slice(2) : idPart, phrase, user }
}

function prelim(text: string, userAliases: UserAlias[]): Classified {
  const foodToken = readFoodToken(text)
  if (foodToken) {
    return {
      kind: 'food',
      text,
      foodId: foodToken.foodId,
      phrase: foodToken.phrase,
      user: foodToken.user,
    }
  }
  const num = parseNumber(text)
  if (num != null && (text in NUMBER_WORDS || /\d/.test(text))) {
    return { kind: 'num', text, num }
  }
  if (text in UNITS) return { kind: 'unit', text, unit: UNITS[text] }
  if (FILLERS.has(text)) return { kind: 'word', text, egg: false }
  if (EGG_WORDS.has(text)) return { kind: 'word', text, egg: true }
  const resolved = resolveWord(text, userAliases)
  if (resolved) {
    return { kind: 'food', text, foodId: resolved.foodId, phrase: text, user: resolved.user }
  }
  return { kind: 'word', text }
}

function classify(segment: string, userAliases: UserAlias[]): Classified[] {
  const raw = segment.match(/«[^»]+»|\d+\s*\/\s*\d+|\d+(?:\.\d+)?|[a-z]+/g) ?? []
  const first = raw
    .map((text) => prelim(text, userAliases))
    .filter((token) => !(token.kind === 'word' && !token.egg && FILLERS.has(token.text)))
  const otherFood = first.some((token) => token.kind === 'food')
  return first.flatMap((token) => {
    if (!token.egg) return [token]
    if (otherFood) return [{ kind: 'unit' as const, text: token.text, unit: 'piece' as Unit }]
    const resolved = resolveWord(token.text, userAliases)
    if (!resolved) return [{ kind: 'word' as const, text: token.text }]
    return [{
      kind: 'food' as const,
      text: token.text,
      foodId: resolved.foodId,
      phrase: token.text,
      user: resolved.user,
    }]
  })
}

function takeQtyUnit(tokens: Classified[]): { qty: number | null; unit: Unit | null } {
  let qty: number | null = null
  let unit: Unit | null = null
  for (const token of tokens) {
    if (token.kind === 'num' && token.num != null) qty = token.num
    if (token.kind === 'unit' && token.unit) unit = token.unit
  }
  return { qty, unit }
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10
}

function confidenceFor(
  food: Food,
  via: 'user' | 'exact' | 'fuzzy',
  phrase: string,
  score?: number,
): Confidence {
  if (via === 'user') return 'high'
  if (via === 'fuzzy') return score != null && score <= 0.2 ? 'medium' : 'low'
  if (food.generic && phrase.split(' ').length === 1) return 'medium'
  return 'high'
}

function materialize(
  food: Food,
  via: 'user' | 'exact' | 'fuzzy',
  phrase: string,
  qty: number | null,
  unit: Unit | null,
  raw: string,
  score?: number,
): ParsedItem {
  let chosen = unit
  if (chosen && chosen !== 'g' && food.servings[chosen] == null) chosen = null
  const finalQty = qty ?? (chosen ? 1 : food.defaultServing.qty)
  const finalUnit = chosen ?? food.defaultServing.unit
  const unitGrams = finalUnit === 'g' ? 1 : food.servings[finalUnit] ?? food.servings[food.defaultServing.unit] ?? 100
  const grams = Math.round(finalQty * unitGrams)
  const factor = grams / 100
  return {
    raw,
    query: phrase,
    foodId: food.id,
    name: food.name,
    qty: finalQty,
    unit: finalUnit,
    grams,
    kcal: Math.round(food.per100g.kcal * factor),
    macros: {
      protein: roundMacro(food.per100g.protein * factor),
      carbs: roundMacro(food.per100g.carbs * factor),
      fat: roundMacro(food.per100g.fat * factor),
    },
    confidence: confidenceFor(food, via, phrase, score),
    alternatives: alternativesFor(food.id, phrase),
    note: via === 'user' || !(food.generic && phrase.split(' ').length === 1) ? undefined : food.note,
    source: via === 'exact' ? 'dictionary' : via,
  }
}

function unknownItem(raw: string, phrase: string, qty: number | null, unit: Unit | null): ParsedItem {
  return {
    raw,
    query: phrase,
    foodId: null,
    name: phrase || raw,
    qty: qty ?? 1,
    unit: unit ?? 'piece',
    grams: 0,
    kcal: 0,
    macros: { protein: 0, carbs: 0, fat: 0 },
    confidence: 'low',
    alternatives: [],
    source: 'unknown',
  }
}

function rawText(before: Classified[], phrase: string, after: Classified[]): string {
  const pre = before.filter((token) => token.kind === 'num' || token.kind === 'unit').map((token) => token.text)
  const post = after.filter((token) => token.kind === 'num' || token.kind === 'unit').map((token) => token.text)
  return [...pre, phrase, ...post].filter(Boolean).join(' ')
}

function fromToken(
  token: Classified,
  qty: number | null,
  unit: Unit | null,
  raw: string,
): ParsedItem | null {
  const food = getFood(token.foodId)
  const phrase = token.phrase || token.text
  if (!food) return unknownItem(raw, phrase, qty, unit)
  return materialize(food, token.user ? 'user' : 'exact', phrase, qty, unit, raw)
}

function parseSegment(segment: string, userAliases: UserAlias[]): ParsedItem[] {
  const tokens = classify(segment, userAliases)
  const foodAt = tokens.flatMap((token, index) => (token.kind === 'food' ? [index] : []))
  if (foodAt.length === 0) {
    const words = tokens.filter((token) => token.kind === 'word').map((token) => token.text)
    const phrase = words.join(' ')
    if (!phrase) return []
    const { qty, unit } = takeQtyUnit(tokens)
    const exactId = exactFoodId(phrase)
    if (exactId) {
      const food = getFood(exactId)
      if (food) return [materialize(food, 'exact', phrase, qty, unit, [qty, unit, phrase].filter(Boolean).join(' ') || phrase)]
    }
    const fuzzy = fuzzyFood(phrase)
    if (fuzzy) {
      const food = getFood(fuzzy.foodId)
      if (food) return [materialize(food, 'fuzzy', phrase, qty, unit, phrase, fuzzy.score)]
    }
    return [unknownItem(phrase, phrase, qty, unit)]
  }

  const items: ParsedItem[] = []
  const consumed = new Set<number>()
  for (let i = 0; i < foodAt.length; i += 1) {
    const index = foodAt[i]
    const prev = i === 0 ? -1 : foodAt[i - 1]
    const next = i + 1 < foodAt.length ? foodAt[i + 1] : tokens.length
    const before = tokens.slice(prev + 1, index)
    const after = tokens.slice(index + 1, next)
    let { qty, unit } = takeQtyUnit(before)
    const isLast = i === foodAt.length - 1
    const useAfter = qty == null && unit == null && isLast
    if (useAfter) ({ qty, unit } = takeQtyUnit(after))
    for (const tokenIndex of range(prev + 1, index)) {
      if (tokens[tokenIndex].kind !== 'word') consumed.add(tokenIndex)
    }
    consumed.add(index)
    if (useAfter) {
      for (const tokenIndex of range(index + 1, next)) {
        if (tokens[tokenIndex].kind !== 'word') consumed.add(tokenIndex)
      }
    }
    const phrase = tokens[index].phrase || tokens[index].text
    const raw = rawText(before, phrase, useAfter ? after : [])
    const item = fromToken(tokens[index], qty, unit, raw)
    if (item) items.push(item)
  }

  const leftover: string[] = []
  tokens.forEach((token, index) => {
    if (!consumed.has(index) && token.kind === 'word') leftover.push(token.text)
  })
  if (leftover.length && foodAt.length === 1) {
    const phrase = tokens
      .filter((token) => token.kind === 'word' || token.kind === 'food')
      .map((token) => token.phrase || token.text)
      .join(' ')
    const food = getFood(exactFoodId(phrase))
    if (food) {
      const { qty, unit } = takeQtyUnit(tokens)
      return [materialize(food, 'exact', phrase, qty, unit, phrase)]
    }
    return items
  }
  if (leftover.length) {
    const phrase = leftover.join(' ')
    const fuzzy = phrase.length >= 4 ? fuzzyFood(phrase) : null
    if (fuzzy && fuzzy.score <= 0.3) {
      const food = getFood(fuzzy.foodId)
      if (food) items.push(materialize(food, 'fuzzy', phrase, null, null, phrase, fuzzy.score))
    } else if (phrase.length >= 3) {
      items.push(unknownItem(phrase, phrase, null, null))
    }
  }
  return items
}

function range(start: number, end: number): number[] {
  const indexes: number[] = []
  for (let i = start; i < end; i += 1) indexes.push(i)
  return indexes
}

const NUMBER_PREFIXES = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length)

/** "ekchai" is how people type "ek chai" when they are not spacing words. */
function unglue(text: string): string {
  return text
    .split(' ')
    .map((word) => {
      if (exactSingleFoodId(word)) return word
      const digit = /^(\d+(?:\.\d+)?)([a-z]{3,})$/.exec(word)
      if (digit && exactSingleFoodId(digit[2])) return `${digit[1]} ${digit[2]}`
      for (const prefix of NUMBER_PREFIXES) {
        if (prefix.length < 2 || word.length < prefix.length + 3 || !word.startsWith(prefix)) continue
        const rest = word.slice(prefix.length)
        if (exactSingleFoodId(rest)) return `${prefix} ${rest}`
      }
      return word
    })
    .join(' ')
}

export function parse(text: string, userAliases: UserAlias[] = []): ParsedItem[] {
  const normalized = unglue(normalize(text))
  if (!normalized) return []
  const protectedText = protect(normalized, userAliases)
  const segments = protectedText
    .split(/\s*(?:,|&|\+)\s*|\s+(?:and|aur|with|n)\s+/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
  return segments.flatMap((segment) => parseSegment(segment, userAliases))
}
