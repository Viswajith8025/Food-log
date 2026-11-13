import { describe, expect, it } from 'vitest'
import { getFood } from '../data/search.ts'
import { parse } from './parse.ts'
import type { Unit } from '../data/types.ts'
import type { Confidence, UserAlias } from './types.ts'

interface Expected {
  id: string | null
  qty: number
  unit: Unit
  confidence?: Confidence
}

function meal(text: string, aliases: UserAlias[] = []) {
  return parse(text, aliases).map((item) => ({
    id: item.foodId,
    qty: item.qty,
    unit: item.unit,
    confidence: item.confidence,
  }))
}

const cases: { text: string; expect: Expected[] }[] = [
  {
    text: '2 roti, dal aur ek katori sabzi',
    expect: [
      { id: 'roti', qty: 2, unit: 'piece', confidence: 'high' },
      { id: 'dal-tadka', qty: 1, unit: 'katori', confidence: 'high' },
      { id: 'mixed-veg-sabzi', qty: 1, unit: 'katori', confidence: 'medium' },
    ],
  },
  {
    text: '2 roti dal aur ek katori sabzi',
    expect: [
      { id: 'roti', qty: 2, unit: 'piece' },
      { id: 'dal-tadka', qty: 1, unit: 'katori' },
      { id: 'mixed-veg-sabzi', qty: 1, unit: 'katori' },
    ],
  },
  { text: '1 plate chole bhature', expect: [{ id: 'chole-bhature', qty: 1, unit: 'plate', confidence: 'high' }] },
  { text: '1 plate chole bhatura', expect: [{ id: 'chole-bhature', qty: 1, unit: 'plate' }] },
  { text: 'choley bhature', expect: [{ id: 'chole-bhature', qty: 1, unit: 'plate' }] },
  { text: 'maggi', expect: [{ id: 'maggi', qty: 1, unit: 'pack', confidence: 'high' }] },
  { text: 'maggie', expect: [{ id: 'maggi', qty: 1, unit: 'pack' }] },
  { text: 'MAGGI!', expect: [{ id: 'maggi', qty: 1, unit: 'pack' }] },
  {
    text: 'do paratha with curd',
    expect: [
      { id: 'paratha', qty: 2, unit: 'piece', confidence: 'high' },
      { id: 'curd', qty: 1, unit: 'bowl', confidence: 'high' },
    ],
  },
  { text: 'half plate biryani', expect: [{ id: 'chicken-biryani', qty: 0.5, unit: 'plate', confidence: 'medium' }] },
  { text: 'aadha plate biryani', expect: [{ id: 'chicken-biryani', qty: 0.5, unit: 'plate' }] },
  { text: 'biriyani', expect: [{ id: 'chicken-biryani', qty: 1, unit: 'plate' }] },
  { text: 'chai 2 cup', expect: [{ id: 'chai', qty: 2, unit: 'cup', confidence: 'high' }] },
  { text: '3 idli sambar', expect: [{ id: 'idli-sambar', qty: 3, unit: 'piece', confidence: 'high' }] },
  { text: 'paanch idli', expect: [{ id: 'idli', qty: 5, unit: 'piece' }] },
  { text: 'rice dal', expect: [{ id: 'dal-chawal', qty: 1, unit: 'plate' }] },
  { text: 'dal chawal', expect: [{ id: 'dal-chawal', qty: 1, unit: 'plate' }] },
  { text: 'dal and rice', expect: [{ id: 'dal-chawal', qty: 1, unit: 'plate' }] },
  {
    text: '2 roti, aloo sabji, salad',
    expect: [
      { id: 'roti', qty: 2, unit: 'piece' },
      { id: 'aloo-sabzi', qty: 1, unit: 'katori', confidence: 'high' },
      { id: 'salad', qty: 1, unit: 'plate', confidence: 'medium' },
    ],
  },
  { text: '1.5 katori rajma chawal', expect: [{ id: 'rajma-chawal', qty: 1.5, unit: 'katori' }] },
  { text: 'egg bhurji 2 eggs', expect: [{ id: 'egg-bhurji', qty: 2, unit: 'piece' }] },
  { text: 'banana', expect: [{ id: 'banana', qty: 1, unit: 'piece' }] },
  { text: '2 chapathi', expect: [{ id: 'roti', qty: 2, unit: 'piece' }] },
  { text: 'daal', expect: [{ id: 'dal-tadka', qty: 1, unit: 'katori' }] },
  { text: 'subzi', expect: [{ id: 'mixed-veg-sabzi', qty: 1, unit: 'katori', confidence: 'medium' }] },
  { text: 'dedh katori dal', expect: [{ id: 'dal-tadka', qty: 1.5, unit: 'katori' }] },
  { text: 'dhai roti', expect: [{ id: 'roti', qty: 2.5, unit: 'piece' }] },
  { text: 'ek dosa', expect: [{ id: 'dosa', qty: 1, unit: 'piece' }] },
  { text: 'char idli', expect: [{ id: 'idli', qty: 4, unit: 'piece' }] },
  { text: '1/2 plate poha', expect: [{ id: 'poha', qty: 0.5, unit: 'plate' }] },
  {
    text: 'roti n dal',
    expect: [
      { id: 'roti', qty: 1, unit: 'piece' },
      { id: 'dal-tadka', qty: 1, unit: 'katori' },
    ],
  },
  {
    text: '2 roti + dal',
    expect: [
      { id: 'roti', qty: 2, unit: 'piece' },
      { id: 'dal-tadka', qty: 1, unit: 'katori' },
    ],
  },
  {
    text: '2 roti & sabzi',
    expect: [
      { id: 'roti', qty: 2, unit: 'piece' },
      { id: 'mixed-veg-sabzi', qty: 1, unit: 'katori' },
    ],
  },
  { text: 'teen paratha', expect: [{ id: 'paratha', qty: 3, unit: 'piece' }] },
  { text: '1 glass lassi', expect: [{ id: 'lassi', qty: 1, unit: 'glass' }] },
  { text: '2 samosa', expect: [{ id: 'samosa', qty: 2, unit: 'piece' }] },
  { text: '2 samosas', expect: [{ id: 'samosa', qty: 2, unit: 'piece' }] },
  { text: 'masala dosa', expect: [{ id: 'masala-dosa', qty: 1, unit: 'piece' }] },
  { text: '1 bowl curd', expect: [{ id: 'curd', qty: 1, unit: 'bowl' }] },
  { text: 'poha', expect: [{ id: 'poha', qty: 1, unit: 'plate' }] },
  { text: 'upma', expect: [{ id: 'upma', qty: 1, unit: 'plate' }] },
  { text: 'paneer butter masala', expect: [{ id: 'paneer-butter-masala', qty: 1, unit: 'katori' }] },
  { text: '2 tbsp ghee', expect: [{ id: 'ghee', qty: 2, unit: 'tbsp' }] },
  { text: '  2   ROTI  ', expect: [{ id: 'roti', qty: 2, unit: 'piece' }] },
  { text: '2 rotis', expect: [{ id: 'roti', qty: 2, unit: 'piece' }] },
  { text: 'one plate rajma chawal', expect: [{ id: 'rajma-chawal', qty: 1, unit: 'plate' }] },
  {
    text: 'chai aur biscuit',
    expect: [
      { id: 'chai', qty: 1, unit: 'cup' },
      { id: 'biscuit', qty: 2, unit: 'piece' },
    ],
  },
  { text: '2 boiled eggs', expect: [{ id: 'boiled-egg', qty: 2, unit: 'piece' }] },
  { text: '2 anda', expect: [{ id: 'boiled-egg', qty: 2, unit: 'piece' }] },
  { text: '1 katori dahi', expect: [{ id: 'curd', qty: 1, unit: 'katori' }] },
  { text: 'bhindi fry', expect: [{ id: 'bhindi-fry', qty: 1, unit: 'katori' }] },
  { text: '3 pc roti', expect: [{ id: 'roti', qty: 3, unit: 'piece' }] },
  { text: 'xyz random food', expect: [{ id: null, qty: 1, unit: 'piece', confidence: 'low' }] },
  { text: 'a plate of poha', expect: [{ id: 'poha', qty: 1, unit: 'plate' }] },
  { text: 'smosa', expect: [{ id: 'samosa', qty: 1, unit: 'piece' }] },
]

describe('parse', () => {
  it.each(cases)('$text', ({ text, expect: expected }) => {
    const parsed = meal(text)
    expect(parsed).toHaveLength(expected.length)
    expected.forEach((row, index) => {
      expect(parsed[index].id).toBe(row.id)
      expect(parsed[index].qty).toBe(row.qty)
      expect(parsed[index].unit).toBe(row.unit)
      if (row.confidence) expect(parsed[index].confidence).toBe(row.confidence)
    })
  })

  it('does not split a named dish into its ingredients', () => {
    expect(parse('dal chawal')).toHaveLength(1)
    expect(parse('chole bhature')).toHaveLength(1)
    expect(parse('paneer butter masala')).toHaveLength(1)
    expect(parse('3 idli sambar')).toHaveLength(1)
    expect(parse('idli')).toHaveLength(1)
    expect(parse('idli')[0].foodId).toBe('idli')
  })

  it('computes kcal from the serving weight', () => {
    const roti = getFood('roti')
    expect(roti).toBeTruthy()
    const grams = 2 * (roti?.servings.piece ?? 0)
    const expected = Math.round(((roti?.per100g.kcal ?? 0) * grams) / 100)
    const item = parse('2 roti')[0]
    expect(item.grams).toBe(grams)
    expect(item.kcal).toBe(expected)
    expect(item.macros.protein).toBeGreaterThan(0)
  })

  it('offers specific sabzis when the word was generic', () => {
    const item = parse('sabzi')[0]
    expect(item.alternatives).toContain('bhindi-fry')
    expect(item.note).toMatch(/tap to choose/i)
  })

  it('lets a personal alias beat the generic dictionary', () => {
    const parsed = parse('ek katori sabzi', [{ phrase: 'sabzi', foodId: 'bhindi-fry' }])
    expect(parsed[0]).toMatchObject({
      foodId: 'bhindi-fry',
      qty: 1,
      unit: 'katori',
      confidence: 'high',
      source: 'user',
    })
  })

  it('does not let a one-word memory steal a longer dish', () => {
    const parsed = parse('aloo sabzi', [{ phrase: 'sabzi', foodId: 'bhindi-fry' }])
    expect(parsed[0].foodId).toBe('aloo-sabzi')
  })

  it('keeps a known item when the rest of the sentence is junk', () => {
    const parsed = parse('2 roti and xyz random food')
    expect(parsed[0].foodId).toBe('roti')
    expect(parsed[1].foodId).toBeNull()
    expect(parsed[1].confidence).toBe('low')
  })

  it('ignores an empty note', () => {
    expect(parse('')).toEqual([])
    expect(parse('   , and  ')).toEqual([])
  })
})
