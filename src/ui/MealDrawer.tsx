import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import type { Meal } from '../db/db.ts'
import { formatAmount } from '../parser/portion.ts'
import type { ParsedItem } from '../parser/types.ts'
import type { Unit } from '../data/types.ts'
import { formatMealTime, mealSlot } from '../lib/when.ts'
import { ItemCard } from './ItemCard.tsx'
import type { DayChoice } from './useLog.ts'

function sourceLabel(item: ParsedItem): string {
  return item.source === 'ai' ? 'AI estimate' : 'Food list'
}

export function MealDrawer({
  meal,
  day,
  onOpenChange,
  onQty,
  onName,
  onRemoveItem,
  onMove,
  onAgain,
  onDelete,
}: {
  meal: Meal | null
  day: DayChoice
  onOpenChange: (open: boolean) => void
  onQty: (index: number, qty: number, unit: Unit) => void
  onName: (index: number) => void
  onRemoveItem: (index: number) => void
  onMove: (which: DayChoice) => void
  onAgain: () => void
  onDelete: () => void
}) {
  const when = meal ? new Date(meal.createdAt) : null
  const other: DayChoice = day === 'today' ? 'yesterday' : 'today'

  return (
    <Drawer open={meal != null} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-food text-2xl">{meal?.text ?? 'Meal'}</DrawerTitle>
          {when && (
            <p className="text-sm text-[oklch(0.4_0.04_50)]">
              {formatMealTime(when)} · {mealSlot(when)} · {meal?.kcal ?? 0} kcal
            </p>
          )}
        </DrawerHeader>
        <div className="flex max-h-[50dvh] flex-col gap-2 overflow-y-auto px-4 pb-2">
          {meal?.items.map((item, index) => (
            <div key={`${item.raw}-${index}`} className="shrink-0">
              <ItemCard
                item={item}
                checking={false}
                onName={() => onName(index)}
                onRemove={() => onRemoveItem(index)}
                onQty={(qty, unit) => onQty(index, qty, unit)}
              />
              <p className="px-4 pt-1 text-sm text-[oklch(0.4_0.04_50)]">
                {formatAmount(item.qty, item.unit)}
                {item.grams > 0 ? ` · ${item.grams}g` : ''} · P {Math.round(item.macros.protein)} · C {Math.round(item.macros.carbs)} · F {Math.round(item.macros.fat)} · {sourceLabel(item)}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" className="min-h-11 rounded-2xl bg-muted px-3 text-left text-sm hover:bg-accent" onClick={() => onMove(other)}>
            Move to {other}
          </button>
          <button type="button" className="min-h-11 rounded-2xl bg-muted px-3 text-left text-sm hover:bg-accent" onClick={onAgain}>
            Log again
          </button>
          <button type="button" className="min-h-11 rounded-2xl px-3 text-left text-sm text-[oklch(0.42_0.14_30)] hover:bg-muted" onClick={onDelete}>
            Delete meal
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
