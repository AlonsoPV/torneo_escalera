import { Filter, X } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Group, GroupCategory, Tournament } from '@/types/database'
import { cn } from '@/lib/utils'

function localeEsNumericNameCompare(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

function tournamentDashboardSort(a: Tournament, b: Tournament): number {
  const rank = (t: Tournament) => (t.status === 'active' ? 0 : t.status === 'finished' ? 1 : 2)
  const dr = rank(a) - rank(b)
  if (dr !== 0) return dr
  return localeEsNumericNameCompare(a.name, b.name)
}

function selectTriggerClass(active: boolean) {
  return cn(
    'h-10 w-full rounded-xl border border-border/80 bg-background text-sm shadow-sm transition-colors',
    'hover:border-emerald-500/40 hover:bg-muted/40',
    'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
    '*:data-[slot=select-value]:font-medium *:data-[slot=select-value]:text-foreground',
    active && 'border-emerald-500/45 bg-emerald-500/[0.07] ring-1 ring-emerald-500/20',
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
  )
}

export function TournamentFiltersBar({
  tournaments,
  tournamentId,
  groupCategories,
  groupCategoryId,
  groups,
  groupId,
  isFetching,
  onTournamentChange,
  onGroupCategoryChange,
  onGroupChange,
  onClearFilters,
}: {
  tournaments: Tournament[]
  tournamentId: string
  groupCategories: GroupCategory[]
  groupCategoryId: 'all' | 'none' | string
  groups: Group[]
  groupId: 'all' | string
  isFetching?: boolean
  onTournamentChange: (id: string) => void
  onGroupCategoryChange: (id: 'all' | 'none' | string) => void
  onGroupChange: (id: 'all' | string) => void
  onClearFilters: () => void
}) {
  const sortedTournaments = useMemo(
    () => [...tournaments].sort(tournamentDashboardSort),
    [tournaments],
  )

  const sortedCategories = useMemo(
    () =>
      [...groupCategories].sort(
        (a, b) => a.order_index - b.order_index || localeEsNumericNameCompare(a.name, b.name),
      ),
    [groupCategories],
  )

  const sortedGroups = useMemo(
    () =>
      [...groups].sort(
        (a, b) =>
          (a.order_index ?? 0) - (b.order_index ?? 0) ||
          localeEsNumericNameCompare(a.name, b.name),
      ),
    [groups],
  )

  const filtersActive = groupCategoryId !== 'all' || groupId !== 'all'

  const tournamentLabel = sortedTournaments.find((t) => t.id === tournamentId)?.name ?? '—'

  const categoryTriggerLabel =
    groupCategoryId === 'all'
      ? 'Todas'
      : groupCategoryId === 'none'
        ? 'Sin categoría'
        : sortedCategories.find((c) => c.id === groupCategoryId)?.name ?? 'Todas'

  const groupTriggerLabel = groupId === 'all' ? 'Todos' : sortedGroups.find((g) => g.id === groupId)?.name ?? 'Todos'

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <Filter className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Filtros</p>
              <p className="text-xs text-muted-foreground">
                Por defecto se muestra todo el torneo; acota categoría o grupo.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {isFetching ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                <span
                  className="size-4 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-emerald-600 dark:border-t-emerald-400"
                  aria-hidden
                />
                Actualizando
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-xl border-border/80"
              disabled={!filtersActive}
              onClick={onClearFilters}
            >
              <X className="size-3.5 opacity-70" aria-hidden />
              Limpiar filtros
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0 space-y-1.5">
            <FieldLabel>Torneo</FieldLabel>
            <Select
              value={tournamentId}
              onValueChange={(v) => {
                if (v) onTournamentChange(v)
              }}
            >
              <SelectTrigger
                size="sm"
                className={selectTriggerClass(false)}
                aria-label={`Torneo: ${tournamentLabel}`}
              >
                <SelectValue placeholder="Elegir torneo">{tournamentLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortedTournaments.map((x) => (
                  <SelectItem key={x.id} value={x.id} label={x.name}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1.5">
            <FieldLabel>Categoría</FieldLabel>
            <Select
              value={groupCategoryId}
              onValueChange={(v) => onGroupCategoryChange((v ?? 'all') as 'all' | 'none' | string)}
            >
              <SelectTrigger
                size="sm"
                className={selectTriggerClass(groupCategoryId !== 'all')}
                aria-label={`Categoría: ${categoryTriggerLabel}`}
              >
                <SelectValue placeholder="Todas">{categoryTriggerLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="Todas">
                  Todas
                </SelectItem>
                <SelectItem value="none" label="Sin categoría">
                  Sin categoría
                </SelectItem>
                {sortedCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id} label={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1.5 sm:col-span-2 xl:col-span-1">
            <FieldLabel>Grupo</FieldLabel>
            <Select value={groupId} onValueChange={(v) => onGroupChange((v ?? 'all') as 'all' | string)}>
              <SelectTrigger
                size="sm"
                className={selectTriggerClass(groupId !== 'all')}
                aria-label={`Grupo: ${groupTriggerLabel}`}
              >
                <SelectValue placeholder="Todos">{groupTriggerLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="Todos">
                  Todos
                </SelectItem>
                {sortedGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id} label={g.name}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
          Categoría y grupo siguen el orden definido en administración (Grupo 1, Grupo 2…). «Todos» / «Todas» incluyen
          todo el alcance actual del torneo.
        </p>
      </CardContent>
    </Card>
  )
}
