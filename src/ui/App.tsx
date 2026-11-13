import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { dayKey } from '../db/db.ts'
import { formatMealTime, mealSlot } from '../lib/when.ts'
import { withQtyUnit } from '../parser/portion.ts'
import { FoodDrawer } from './FoodDrawer.tsx'
import { ItemCard } from './ItemCard.tsx'
import { MealDrawer } from './MealDrawer.tsx'
import { useLog, type DayChoice } from './useLog.ts'

function useKeyboardOffset() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const sync = () => {
      const overlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      document.documentElement.style.setProperty('--kb', `${overlap}px`)
    }
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    sync()
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
    }
  }, [])
}

export default function App() {
  useKeyboardOffset()
  const log = useLog()
  const mealRef = useRef<HTMLTextAreaElement>(null)
  const pickerItem = log.picker == null ? null : log.drafts[log.picker] ?? null
  const savedItem = log.savedPicker == null ? null : log.openMeal?.items[log.savedPicker] ?? null
  const dayName = log.day === 'today' ? 'Today' : 'Yesterday'
  const compactDrafts = log.drafts.length > 3
  const lot = log.drafts.some((item) => item.note?.includes("That's a lot"))
  const [confirmLot, setConfirmLot] = useState(false)
  const lotKey = log.drafts.map((item) => `${item.foodId}:${item.qty}:${item.unit}:${item.kcal}`).join('|')

  useEffect(() => {
    setConfirmLot(false)
  }, [lotKey])

  function grow(field: HTMLTextAreaElement) {
    field.style.height = 'auto'
    field.style.height = `${Math.min(field.scrollHeight, 72)}px`
  }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-background text-foreground" style={{ paddingBottom: 'var(--kb, 0px)' }}>
      <a href="#meal" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-3 focus:py-2 focus:text-background">
        Skip to meal
      </a>
      <header className="shrink-0 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-food text-[2rem] leading-none tracking-[-0.03em]">{dayName}</h1>
            <div className="mt-2 grid grid-cols-2 rounded-xl bg-muted p-1" role="group" aria-label="Which day">
              {(['yesterday', 'today'] as DayChoice[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={log.day === choice}
                  onClick={() => log.setDay(choice)}
                  className={`min-h-11 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${log.day === choice ? 'bg-card' : ''}`}
                >
                  {choice === 'today' ? 'Today' : 'Yesterday'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-[oklch(0.4_0.04_50)] tabular-nums">
              {Math.round(log.daySum.protein)}g protein · {Math.round(log.daySum.carbs)}g carbs · {Math.round(log.daySum.fat)}g fat
            </p>
          </div>
          <p className="font-food text-4xl leading-none tracking-[-0.03em] tabular-nums">
            {Math.round(log.daySum.kcal)}
            <span className="ml-1 text-base">kcal</span>
          </p>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
        {log.drafts.length > 0 && (
          <div className="flex flex-col gap-2">
            {log.drafts.map((item, index) => (
              <ItemCard
                key={`${item.raw}-${index}`}
                item={item}
                compact={compactDrafts}
                checking={log.checking}
                onName={() => log.setPicker(index)}
                onRemove={() => log.removeDraft(index)}
                onQty={(qty, unit) => log.setQty(index, qty, unit)}
              />
            ))}
          </div>
        )}
        {log.meals.length === 0 && log.drafts.length === 0 ? (
          <p className="pt-6 text-[oklch(0.4_0.04_50)]">Nothing logged for {dayName.toLowerCase()} yet.</p>
        ) : log.meals.length === 0 ? null : (
          <ul className="flex flex-col gap-2">
            {log.meals.map((meal) => {
              const when = new Date(meal.createdAt)
              return (
                <li key={meal.id} className="shrink-0">
                  <button type="button" className="min-h-11 w-full rounded-2xl px-1 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => meal.id != null && log.setOpenId(meal.id)}>
                    <p className="text-sm text-[oklch(0.4_0.04_50)]">{formatMealTime(when)} · {mealSlot(when)}</p>
                    <p className="font-food text-xl leading-tight break-words">{meal.text}</p>
                    <p className="mt-1 text-sm text-[oklch(0.4_0.04_50)]">
                      {meal.kcal} kcal · {meal.items.map((item) => item.name).join(', ')}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="sr-only" aria-live="polite">
          {log.drafts.length === 0
            ? ''
            : `${log.drafts.length} ${log.drafts.length === 1 ? 'item' : 'items'}, ${Math.round(log.draftSum.kcal)} kcal, saving to ${dayName} ${dayKey(log.day)}`}
        </p>
      </main>

      <form
        className="relative z-20 shrink-0 border-t border-border bg-background px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault()
          if (lot && !confirmLot) {
            setConfirmLot(true)
            return
          }
          setConfirmLot(false)
          void log.saveDraft().then(() => mealRef.current?.focus())
        }}
      >
        {log.recent.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {log.recent.map((meal) => (
              <button
                key={meal.id}
                type="button"
                onClick={() => void log.relog(meal)}
                title={meal.text}
                className="min-h-11 max-w-44 shrink-0 truncate rounded-full bg-muted px-3 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {meal.text}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={mealRef}
          id="meal"
          name="meal"
          rows={1}
          autoFocus
          value={log.text}
          onChange={(event) => {
            log.setText(event.target.value)
            grow(event.target)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder="1 plate poha aur chai"
          aria-label="What did you eat?"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className="max-h-[4.5rem] min-h-12 w-full resize-none overflow-y-auto rounded-2xl border border-input bg-card px-3 py-3 text-base leading-5 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" disabled={log.drafts.length === 0} className="mt-2 h-auto min-h-12 w-full rounded-2xl px-3 py-2 text-base whitespace-normal">
          {log.drafts.length === 0 ? 'Save' : lot && confirmLot ? `Save ${Math.round(log.draftSum.kcal)} kcal? Check quantity` : `Save ${Math.round(log.draftSum.kcal)} kcal`}
        </Button>
      </form>

      {log.toast && (
        <div role="status" className="fixed bottom-[calc(var(--kb,0px)+7.5rem)] left-1/2 z-40 flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-full bg-foreground px-4 py-2 text-sm text-background">
          <span>{log.toast}</span>
          {log.canUndo && (
            <button type="button" className="min-h-11 font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background" onClick={() => void log.undoRemove()}>
              Undo
            </button>
          )}
        </div>
      )}

      <MealDrawer
        meal={log.openMeal}
        day={log.day}
        onOpenChange={(open) => {
          if (!open) log.setOpenId(null)
        }}
        onQty={(index, qty, unit) => {
          const item = log.openMeal?.items[index]
          if (!item) return
          void log.editSaved(index, withQtyUnit(item, qty, unit))
        }}
        onName={(index) => log.setSavedPicker(index)}
        onRemoveItem={(index) => void log.removeSavedItem(index)}
        onMove={(which) => void log.moveMeal(which)}
        onAgain={() => {
          if (!log.openMeal) return
          void log.relog(log.openMeal)
          log.setOpenId(null)
        }}
        onDelete={() => {
          const id = log.openMeal?.id
          log.setOpenId(null)
          void log.removeMeal(id)
        }}
      />

      <FoodDrawer
        item={pickerItem ?? savedItem}
        open={pickerItem != null || savedItem != null}
        onOpenChange={(open) => {
          if (!open) {
            log.setPicker(null)
            log.setSavedPicker(null)
          }
        }}
        onPick={(foodId) => {
          if (log.picker != null) void log.chooseFood(log.picker, foodId)
          else void log.chooseSaved(foodId)
        }}
      />
    </div>
  )
}
