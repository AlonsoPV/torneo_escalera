import { Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Group } from '@/types/database'

export function GroupVerticalPicker(props: {
  groups: Group[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** `rail`: lista vertical (por defecto). `chips`: fila de pastillas. */
  layout?: 'rail' | 'chips'
  /** En `true`, en pantallas grandes las pastillas pasan a columna (sidebar). */
  responsive?: boolean
  className?: string
}) {
  const { groups, selectedId, onSelect, layout = 'rail', responsive, className } = props

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay grupos en este torneo.
      </p>
    )
  }

  const isChips = layout === 'chips'

  return (
    <div
      className={cn(
        isChips
          ? cn(
              'flex flex-wrap gap-2',
              responsive && 'lg:flex-col lg:flex-nowrap lg:gap-1.5',
            )
          : 'flex flex-col gap-1.5',
        className,
      )}
      role="tablist"
      aria-label="Grupos del torneo"
    >
      {groups.map((g) => {
        const active = g.id === selectedId
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border text-left text-sm font-medium transition-all',
              isChips ? 'px-3 py-1.5' : 'px-3 py-2.5',
              isChips && responsive && 'lg:w-full lg:justify-start',
              active
                ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                : 'border-border bg-card hover:border-primary/30 hover:bg-muted/50',
            )}
          >
            <Users
              className={cn('size-3.5 shrink-0 opacity-60', active && 'opacity-100')}
              aria-hidden
            />
            <span className="min-w-0">{g.name}</span>
          </button>
        )
      })}
    </div>
  )
}
