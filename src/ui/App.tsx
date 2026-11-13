import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dayKey } from '../db/db.ts'
import { FoodDrawer } from './FoodDrawer.tsx'
import { ItemCard } from './ItemCard.tsx'
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
  const mealRef = useRef<HTMLInputElement>(null)
  const pickerItem = log.picker == null ? null : log.drafts[log.picker] ?? null
  const dayName = log.day === 'today' ? 'Today' : 'Yesterday'

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-background text-foreground" style={{ paddingBottom: 'var(--kb, 0px)' }}>
      <a href="#meal" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-3 focus:py-2 focus:text-background">
        Skip to meal
      </a>
      <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-food text-[2rem] leading-none tracking-[-0.03em]">{dayName}</h1>
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

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {log.meals.length === 0 ? (
          <p className="pt-6 text-[oklch(0.4_0.04_50)]">Nothing logged for {dayName.toLowerCase()} yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {log.meals.map((meal) => (
              <li key={meal.id} className="flex items-start gap-2 border-b border-border pb-3">
                <div className="min-w-0 flex-1">
                  <p className="font-food text-xl leading-tight break-words">{meal.text}</p>
                  <p className="mt-1 text-sm text-[oklch(0.4_0.04_50)]">
                    {meal.kcal} kcal · {meal.items.map((item) => item.name).join(', ')}
                  </p>
                </div>
                <button type="button" className="min-h-11 shrink-0 rounded-xl px-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => void log.removeMeal(meal.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="sr-only" aria-live="polite">
          {log.drafts.length === 0
            ? ''
            : `${log.drafts.length} ${log.drafts.length === 1 ? 'item' : 'items'}, ${Math.round(log.draftSum.kcal)} kcal, saving to ${dayName} ${dayKey(log.day)}`}
        </p>
      </main>

      <form
        className="relative z-20 border-t border-border bg-background px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault()
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
        {log.drafts.length > 0 && (
          <div className="mb-3 flex max-h-[38dvh] flex-col gap-2 overflow-y-auto">
            {log.drafts.map((item, index) => (
              <ItemCard
                key={`${item.raw}-${index}`}
                item={item}
                checking={log.checking}
                onName={() => log.setPicker(index)}
                onRemove={() => log.removeDraft(index)}
                onQty={(qty, unit) => log.setQty(index, qty, unit)}
              />
            ))}
          </div>
        )}
        <Input
          ref={mealRef}
          id="meal"
          name="meal"
          autoFocus
          value={log.text}
          onChange={(event) => log.setText(event.target.value)}
          placeholder="1 plate poha aur chai"
          aria-label="What did you eat?"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className="h-12 rounded-2xl bg-card px-3 text-base"
        />
        <div className="mt-2 flex items-stretch gap-2">
          <div className="grid shrink-0 grid-cols-2 rounded-2xl bg-muted p-1" role="group" aria-label="Which day">
            {(['yesterday', 'today'] as DayChoice[]).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={log.day === choice}
                onClick={() => log.setDay(choice)}
                className={`min-h-11 rounded-xl px-2 text-sm hover:bg-card/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${log.day === choice ? 'bg-card shadow-[0_6px_16px_-12px_oklch(0.35_0.04_50)]' : ''}`}
              >
                {choice === 'today' ? 'Today' : 'Yesterday'}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={log.drafts.length === 0} className="h-12 min-h-11 flex-1 rounded-2xl text-base">
            {log.drafts.length === 0 ? 'Save' : `Save ${Math.round(log.draftSum.kcal)} kcal`}
          </Button>
        </div>
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

      <FoodDrawer
        item={pickerItem}
        open={pickerItem != null}
        onOpenChange={(open) => {
          if (!open) log.setPicker(null)
        }}
        onPick={(foodId) => {
          if (log.picker == null) return
          void log.chooseFood(log.picker, foodId)
        }}
      />
    </div>
  )
}
