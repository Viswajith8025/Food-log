import { useCallback, useEffect, useRef, useState } from 'react'
import { db, dayKey, mealsFor, recentMeals, type Meal } from '../db/db.ts'
import { applyLlmFallback, type AiEstimate } from '../parser/llmFallback.ts'
import { parse } from '../parser/parse.ts'
import { withFood, withQtyUnit } from '../parser/portion.ts'
import type { Unit } from '../data/types.ts'
import type { ParsedItem, UserAlias } from '../parser/types.ts'
import { normalize } from '../parser/normalize.ts'

export type DayChoice = 'today' | 'yesterday'

const cache = {
  async get(key: string): Promise<AiEstimate | undefined> {
    const row = await db.llmCache.get(key)
    if (!row) return undefined
    return {
      name: row.name,
      grams: row.grams,
      kcal: row.kcal,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      confidence: row.confidence,
    }
  },
  async set(key: string, value: AiEstimate) {
    await db.llmCache.put({
      key,
      name: value.name,
      grams: value.grams,
      kcal: value.kcal,
      protein: value.protein,
      carbs: value.carbs,
      fat: value.fat,
      confidence: String(value.confidence),
      updatedAt: Date.now(),
    })
  },
}

function totals(items: { kcal: number; macros?: { protein: number; carbs: number; fat: number }; protein?: number; carbs?: number; fat?: number }[]) {
  return items.reduce<{ kcal: number; protein: number; carbs: number; fat: number }>(
    (sum, item) => ({
      kcal: sum.kcal + item.kcal,
      protein: sum.protein + (item.macros?.protein ?? item.protein ?? 0),
      carbs: sum.carbs + (item.macros?.carbs ?? item.carbs ?? 0),
      fat: sum.fat + (item.macros?.fat ?? item.fat ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function useLog() {
  const [text, setText] = useState('')
  const [drafts, setDrafts] = useState<ParsedItem[]>([])
  const [day, setDay] = useState<DayChoice>('today')
  const [meals, setMeals] = useState<Meal[]>([])
  const [recent, setRecent] = useState<Meal[]>([])
  const [aliases, setAliases] = useState<UserAlias[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [undoMeal, setUndoMeal] = useState<Meal | null>(null)
  const [picker, setPicker] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const aliasesRef = useRef(aliases)
  const lockText = useRef<string | null>(null)
  const gen = useRef(0)
  aliasesRef.current = aliases

  const refresh = useCallback(async (which = day) => {
    const [logged, again, savedAliases] = await Promise.all([
      mealsFor(dayKey(which)),
      recentMeals(8),
      db.aliases.toArray(),
    ])
    setMeals(logged)
    setRecent(again)
    setAliases(savedAliases.map((row) => ({ phrase: row.phrase, foodId: row.foodId })))
  }, [day])

  useEffect(() => {
    void refresh(day).catch(() => setToast('Could not open saved meals.'))
  }, [day, refresh])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => {
      setToast(null)
      setUndoMeal(null)
    }, undoMeal ? 4500 : 2800)
    return () => window.clearTimeout(timer)
  }, [toast, undoMeal])

  useEffect(() => {
    if (lockText.current && lockText.current !== text) lockText.current = null
    const id = ++gen.current
    if (!text.trim()) {
      setDrafts([])
      setChecking(false)
      return
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        if (gen.current !== id || lockText.current === text) return
        const parsed = parse(text, aliasesRef.current)
        if (gen.current !== id || lockText.current === text) return
        setDrafts(parsed)
        if (!parsed.some((item) => item.foodId == null || item.confidence === 'low')) return
        setChecking(true)
        try {
          const enriched = await applyLlmFallback(parsed, { cache })
          if (gen.current !== id || lockText.current === text) return
          setDrafts(enriched)
        } finally {
          if (gen.current === id) setChecking(false)
        }
      })()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [text, aliases])

  function lock() {
    lockText.current = text
  }

  function updateDraft(index: number, next: ParsedItem) {
    lock()
    setDrafts((current) => current.map((item, i) => (i === index ? next : item)))
  }

  async function remember(phrase: string, foodId: string, label: string) {
    const key = normalize(phrase)
    if (!key) return
    await db.aliases.put({ phrase: key, foodId, updatedAt: Date.now() })
    setAliases((current) => {
      const rest = current.filter((alias) => alias.phrase !== key)
      return [...rest, { phrase: key, foodId }]
    })
    setToast(`Remembered. Next time “${key}” is ${label}.`)
  }

  async function chooseFood(index: number, foodId: string) {
    const current = drafts[index]
    if (!current) return
    const next = withFood(current, foodId)
    updateDraft(index, next)
    setPicker(null)
    if (current.query && current.foodId !== foodId) {
      await remember(current.query, foodId, next.name).catch(() => setToast('Could not remember that.'))
    }
  }

  async function saveMeal(meal: { text: string; items: ParsedItem[] }) {
    const sum = totals(meal.items)
    await db.meals.add({
      day: dayKey(day),
      text: meal.text,
      items: meal.items,
      kcal: Math.round(sum.kcal),
      protein: Math.round(sum.protein * 10) / 10,
      carbs: Math.round(sum.carbs * 10) / 10,
      fat: Math.round(sum.fat * 10) / 10,
      createdAt: Date.now(),
    })
    await refresh(day)
  }

  async function saveDraft() {
    if (drafts.length === 0) return
    try {
      await saveMeal({ text: text.trim() || drafts.map((item) => item.name).join(', '), items: drafts })
      setText('')
      setDrafts([])
      lockText.current = null
    } catch {
      setToast('Could not save. Try again.')
    }
  }

  async function relog(meal: Meal) {
    try {
      await saveMeal({ text: meal.text, items: meal.items })
      setToast('Logged again.')
    } catch {
      setToast('Could not save. Try again.')
    }
  }

  async function removeMeal(id: number | undefined) {
    if (id == null) return
    const meal = meals.find((row) => row.id === id) ?? null
    try {
      await db.meals.delete(id)
      setUndoMeal(meal)
      setToast('Removed.')
      await refresh(day)
    } catch {
      setToast('Could not remove that meal.')
    }
  }

  async function undoRemove() {
    const meal = undoMeal
    if (!meal) return
    setUndoMeal(null)
    try {
      await db.meals.put(meal)
      setToast('Restored.')
      await refresh(day)
    } catch {
      setToast('Could not restore that meal.')
    }
  }

  const draftSum = totals(drafts)
  const daySum = meals.reduce(
    (sum, meal) => ({
      kcal: sum.kcal + meal.kcal,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )

  return {
    text,
    setText,
    drafts,
    day,
    setDay,
    meals,
    recent,
    toast,
    picker,
    setPicker,
    checking,
    draftSum,
    daySum,
    setQty: (index: number, qty: number, unit: Unit) => updateDraft(index, withQtyUnit(drafts[index], qty, unit)),
    removeDraft: (index: number) => {
      lock()
      setDrafts((current) => current.filter((_, i) => i !== index))
    },
    chooseFood,
    saveDraft,
    relog,
    removeMeal,
    undoRemove,
    canUndo: undoMeal != null,
  }
}
