import { cn } from '@/lib/utils'
import type { Group } from '@/types/database'

export function GroupVerticalPicker(props: {
  groups: Group[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { groups, selectedId, onSelect } = props

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay grupos en este torneo.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {groups.map((g) => {
        const active = g.id === selectedId
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            className={cn(
              'rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card hover:bg-muted/60',
            )}
          >
            {g.name}
          </button>
        )
      })}
    </div>
  )
}
