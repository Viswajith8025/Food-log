import { useEffect, useMemo, useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { getFood, searchFoods } from '../data/search.ts'
import { withFood } from '../parser/portion.ts'
import type { ParsedItem } from '../parser/types.ts'

export function FoodDrawer({
  item,
  open,
  onOpenChange,
  onPick,
}: {
  item: ParsedItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (foodId: string) => void
}) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open, item?.query])

  const results = useMemo(() => {
    if (!item) return []
    if (!query.trim()) {
      return item.alternatives.flatMap((id) => {
        const food = getFood(id)
        return food ? [food] : []
      })
    }
    return searchFoods(query, 12)
  }, [item, query])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-food text-2xl">What was it?</DrawerTitle>
        </DrawerHeader>
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-6">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search foods…"
            name="food-search"
            aria-label="Search foods"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 text-base"
          />
          {!query.trim() && item && item.alternatives.length > 0 && (
            <p className="text-sm text-[oklch(0.4_0.04_50)]">Closest matches</p>
          )}
          <div className="flex flex-col gap-2">
            {results.map((food) => {
              const preview = item ? withFood(item, food.id) : null
              return (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => onPick(food.id)}
                  className="flex min-h-11 items-center justify-between rounded-2xl bg-muted px-3 py-2 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="font-food text-lg leading-tight">{food.name}</span>
                  {preview && <span className="shrink-0 text-sm tabular-nums">{preview.kcal} kcal</span>}
                </button>
              )
            })}
            {results.length === 0 && <p className="text-sm">Nothing under that name.</p>}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
