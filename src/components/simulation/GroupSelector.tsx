import { cn } from '@/lib/utils'
import type { SimGroup } from '@/types/tournament'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  groups: SimGroup[]
  value: string
  onChange: (groupId: string) => void
  className?: string
}

export function GroupSelector(props: Props) {
  const { groups, value, onChange, className } = props
  const active = groups.find((g) => g.id === value)

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3 md:hidden">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Grupo activo
        </span>
        <Select
          value={value}
          onValueChange={(v) => {
            if (v) onChange(v)
          }}
        >
          <SelectTrigger className="h-10 min-w-[180px] w-[min(100%,14rem)] rounded-xl border-border/80 bg-card shadow-sm">
            <SelectValue placeholder="Grupo" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id} label={g.name}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden md:block">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Grupos
        </p>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border/50 bg-muted/30 p-1.5 shadow-inner">
          {groups.map((g) => {
            const isActive = g.id === value
            return (
              <Button
                key={g.id}
                type="button"
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'rounded-xl px-4 font-semibold transition-all duration-200',
                  isActive &&
                    'bg-teal-700 text-white shadow-sm hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500',
                  !isActive && 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                )}
                onClick={() => onChange(g.id)}
              >
                {g.name}
              </Button>
            )
          })}
        </div>
        {active ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Viendo <span className="font-medium text-foreground">{active.name}</span> · 5 jugadores · 10
            partidos
          </p>
        ) : null}
      </div>
    </div>
  )
}
