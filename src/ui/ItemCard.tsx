import { useRef, useState, type PointerEvent } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import type { Unit } from '../data/types.ts'
import { formatAmount } from '../parser/portion.ts'
import type { ParsedItem } from '../parser/types.ts'

const UNITS: Unit[] = ['piece', 'katori', 'plate', 'g']

function dotClass(confidence: ParsedItem['confidence']): string {
  if (confidence === 'high') return 'bg-[oklch(0.45_0.11_150)]'
  if (confidence === 'medium') return 'bg-[oklch(0.62_0.13_75)]'
  return 'bg-[oklch(0.5_0.17_30)]'
}

export function ItemCard({
  item,
  checking,
  compact = false,
  onQty,
  onName,
  onRemove,
}: {
  item: ParsedItem
  checking: boolean
  compact?: boolean
  onQty: (qty: number, unit: Unit) => void
  onName: () => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const row = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  const dragging = useRef(false)
  const units = [...new Set<Unit>([...UNITS, item.unit])]
  const uncertain = item.confidence !== 'high'

  function pointerDown(event: PointerEvent) {
    if ((event.target as HTMLElement).closest('button')) return
    start.current = { x: event.clientX, y: event.clientY, t: event.timeStamp }
    dragging.current = false
    if (row.current) row.current.style.transition = 'none'
  }

  function pointerMove(event: PointerEvent) {
    if (!start.current || !row.current) return
    const dx = event.clientX - start.current.x
    const dy = event.clientY - start.current.y
    if (!dragging.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      if (Math.abs(dy) > Math.abs(dx)) {
        start.current = null
        return
      }
      dragging.current = true
    }
    row.current.style.transform = `translate3d(${Math.min(0, dx)}px,0,0)`
  }

  function pointerUp(event: PointerEvent) {
    if (!start.current || !row.current) return
    const dx = event.clientX - start.current.x
    const dt = Math.max(1, event.timeStamp - start.current.t)
    const dismiss = dx < -88 || dx / dt < -0.65
    row.current.style.transition = 'transform 180ms cubic-bezier(0.2, 0.9, 0.2, 1)'
    row.current.style.transform = dismiss ? 'translate3d(-110%,0,0)' : 'translate3d(0,0,0)'
    if (dismiss) window.setTimeout(onRemove, 160)
    start.current = null
    dragging.current = false
  }

  return (
    <div className="relative shrink-0 overflow-hidden rounded-2xl">
      <div className="absolute inset-0 flex items-center justify-end bg-[oklch(0.48_0.14_35)] pr-4 text-sm font-medium text-[oklch(0.97_0.02_85)]">
        Remove
      </div>
      <div
        ref={row}
        className={`relative rounded-2xl border px-3 py-2 shadow-[0_8px_20px_-16px_oklch(0.35_0.04_50)] ${uncertain ? 'border-[oklch(0.78_0.08_70)] bg-[oklch(0.95_0.035_80)]' : 'border-border bg-card'}`}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <div className="flex items-center gap-1">
          <span className={`size-2.5 shrink-0 rounded-full ${dotClass(item.confidence)}`} aria-hidden />
          <button type="button" onClick={onName} className="min-h-11 min-w-0 flex-1 truncate text-left font-food text-lg leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {item.name}
            <span className="sr-only">{item.confidence === 'high' ? ', confident' : item.confidence === 'medium' ? ', check this' : ', not sure'}</span>
          </button>
          {compact && (
            <button type="button" onClick={() => setOpen((value) => !value)} className="min-h-11 shrink-0 rounded-xl px-2 text-sm text-[oklch(0.4_0.04_50)]" aria-expanded={open}>
              {formatAmount(item.qty, item.unit)}
            </button>
          )}
          <span className="shrink-0 text-sm tabular-nums">{item.kcal} kcal</span>
          <button type="button" onClick={onRemove} aria-label={`Remove ${item.name}`} className="grid size-11 place-items-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <X aria-hidden="true" />
          </button>
        </div>
        {!compact && (
          <button type="button" onClick={() => setOpen((value) => !value)} className="min-h-11 rounded-xl px-4 text-left text-sm text-[oklch(0.4_0.04_50)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-expanded={open}>
            {formatAmount(item.qty, item.unit)}
            {item.grams > 0 && item.unit !== 'g' && item.unit !== 'ml' ? ` · ${item.grams}g` : ''}
          </button>
        )}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="mx-auto max-w-md">
            <DrawerHeader className="text-left">
              <DrawerTitle className="font-food text-2xl">{item.name}</DrawerTitle>
            </DrawerHeader>
            <div className="flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Less" className="grid size-11 place-items-center rounded-full bg-muted hover:bg-accent" onClick={() => onQty(item.qty - (item.unit === 'g' || item.unit === 'ml' ? 10 : 0.5), item.unit)}>
                  <Minus aria-hidden="true" />
                </button>
                <span className="min-w-16 text-center font-food text-2xl tabular-nums">{formatAmount(item.qty, item.unit)}</span>
                <button type="button" aria-label="More" className="grid size-11 place-items-center rounded-full bg-muted hover:bg-accent" onClick={() => onQty(item.qty + (item.unit === 'g' || item.unit === 'ml' ? 10 : 0.5), item.unit)}>
                  <Plus aria-hidden="true" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {units.map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    aria-pressed={unit === item.unit}
                    onClick={() => onQty(item.qty, unit)}
                    className={`min-h-11 rounded-full px-3 text-sm ${unit === item.unit ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
        {(item.note || item.source === 'ai' || (checking && item.confidence === 'low')) && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
            {item.source === 'ai' && <Badge variant="secondary">AI estimate</Badge>}
            {checking && item.foodId == null && item.source !== 'ai' && <span className="text-sm">Checking…</span>}
            {item.note && <span className="text-sm text-[oklch(0.4_0.04_50)]">{item.note}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
