import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Altura orientativa; TanStack mide en runtime con measureElement. */
const DEFAULT_ROW_PX = 96

type Props<T> = {
  items: T[]
  estimateRowHeight?: number
  renderRow: (item: T, index: number) => ReactNode
  empty: ReactNode
  className?: string
  maxHeight?: string
}

export function AdminResultsVirtualList<T>({
  items,
  estimateRowHeight = DEFAULT_ROW_PX,
  renderRow,
  empty,
  className,
  maxHeight = 'min(72vh, 760px)',
}: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual (filas medidas en runtime)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 8,
  })

  if (items.length === 0) {
    return <>{empty}</>
  }

  const total = virtualizer.getTotalSize()

  return (
    <div
      ref={parentRef}
      className={cn(
        'overflow-auto rounded-xl border border-slate-200/90 bg-white/70 shadow-inner shadow-slate-100',
        className,
      )}
      style={{ maxHeight }}
    >
      <div className="relative w-full" style={{ height: `${total}px` }}>
        {virtualizer.getVirtualItems().map((vi) => (
          <div
            key={vi.key}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full px-2 pb-1.5 pt-0"
            style={{ transform: `translateY(${vi.start}px)` }}
          >
            {renderRow(items[vi.index], vi.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
