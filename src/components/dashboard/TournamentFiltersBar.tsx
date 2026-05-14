import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TournamentDashboardMatchStatusFilter } from '@/services/dashboard/tournamentDashboardService'
import type { Group, GroupCategory, Tournament } from '@/types/database'
import { cn } from '@/lib/utils'

const MATCH_FILTER_OPTIONS: { value: TournamentDashboardMatchStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending_score', label: 'Pendiente de marcador' },
  { value: 'score_submitted', label: 'Marcador enviado' },
  { value: 'player_confirmed', label: 'Aceptado por rival' },
  { value: 'score_disputed', label: 'En disputa' },
  { value: 'closed', label: 'Cerrado / Oficial' },
  { value: 'cancelled', label: 'Cancelado' },
]

const FILTER_CONTROL_BASE =
  'rounded-xl border border-border/80 bg-card text-sm shadow-sm transition-colors hover:border-emerald-500/35 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none'

function chipTriggerClass(active: boolean) {
  return cn(
    'h-auto min-h-10 min-w-0 max-w-[min(100%,18rem)] shrink-0 px-2.5 py-1.5 sm:min-h-8',
    FILTER_CONTROL_BASE,
    '*:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate *:data-[slot=select-value]:font-medium *:data-[slot=select-value]:text-foreground',
    active && 'border-emerald-500/50 bg-emerald-500/[0.06] ring-1 ring-emerald-500/15',
  )
}

function clearButtonClass() {
  return cn(
    'h-auto min-h-10 shrink-0 rounded-xl border-border/80 bg-card px-3 py-1.5 text-sm font-medium shadow-sm sm:min-h-8',
    'text-muted-foreground hover:border-emerald-500/35 hover:bg-muted/50 hover:text-foreground',
    'disabled:opacity-50',
  )
}

function labelForTournamentId(id: unknown, tournaments: Tournament[]): string {
  if (id == null || id === '') return '—'
  const s = String(id)
  return tournaments.find((t) => t.id === s)?.name ?? '—'
}

export function TournamentFiltersBar({
  tournaments,
  tournamentId,
  groupCategories,
  groupCategoryId,
  groups,
  groupId,
  matchStatus,
  isFetching,
  onTournamentChange,
  onGroupCategoryChange,
  onGroupChange,
  onMatchStatusChange,
  onClearFilters,
}: {
  tournaments: Tournament[]
  tournamentId: string
  groupCategories: GroupCategory[]
  groupCategoryId: 'all' | 'none' | string
  groups: Group[]
  groupId: 'all' | string
  matchStatus: TournamentDashboardMatchStatusFilter
  isFetching?: boolean
  onTournamentChange: (id: string) => void
  onGroupCategoryChange: (id: 'all' | 'none' | string) => void
  onGroupChange: (id: 'all' | string) => void
  onMatchStatusChange: (s: TournamentDashboardMatchStatusFilter) => void
  onClearFilters: () => void
}) {
  const sortedCategories = useMemo(
    () =>
      [...groupCategories].sort(
        (a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name, 'es'),
      ),
    [groupCategories],
  )
  const filtersActive =
    groupCategoryId !== 'all' || groupId !== 'all' || matchStatus !== 'all'
  const tournamentName = labelForTournamentId(tournamentId, tournaments)
  /** Texto mostrado en el chip; evita que Base UI muestre el UUID si falla el `label` del ítem. */
  const tournamentChipLabel = tournaments.find((t) => t.id === tournamentId)?.name
  const groupCategoryChipLabel =
    groupCategoryId === 'all'
      ? undefined
      : groupCategoryId === 'none'
        ? 'Sin categoría'
        : sortedCategories.find((c) => c.id === groupCategoryId)?.name
  const groupChipLabel = groupId === 'all' ? undefined : groups.find((g) => g.id === groupId)?.name
  const matchStatusChipLabel =
    matchStatus === 'all' ? undefined : MATCH_FILTER_OPTIONS.find((o) => o.value === matchStatus)?.label

  return (
    <Card className="border-border/80 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div
            className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [touch-action:pan-x]"
            aria-label="Filtros del dashboard"
          >
            <div className="snap-start shrink-0">
            <Select
              value={tournamentId}
              onValueChange={(v) => {
                if (v) onTournamentChange(v)
              }}
            >
              <SelectTrigger
                size="sm"
                className={chipTriggerClass(false)}
                aria-label={`Torneo: ${tournamentName}`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                  <span className="shrink-0 text-muted-foreground">Torneo</span>
                  <span className="shrink-0 text-foreground">:</span>
                  <SelectValue placeholder="—" className="min-w-0 flex-1 truncate">
                    {tournamentChipLabel ?? undefined}
                  </SelectValue>
                </span>
              </SelectTrigger>
              <SelectContent>
                {tournaments.map((x) => (
                  <SelectItem key={x.id} value={x.id} label={x.name}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>

            <div className="snap-start shrink-0">
            <Select
              value={groupCategoryId}
              onValueChange={(v) => onGroupCategoryChange((v ?? 'all') as 'all' | 'none' | string)}
            >
              <SelectTrigger
                size="sm"
                className={chipTriggerClass(groupCategoryId !== 'all')}
                aria-label="Categoría de grupo"
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                  <span className="shrink-0 text-muted-foreground">Categoría</span>
                  <span className="shrink-0 text-foreground">:</span>
                  <SelectValue placeholder="Todas" className="min-w-0 flex-1 truncate">
                    {groupCategoryChipLabel ?? undefined}
                  </SelectValue>
                </span>
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

            <div className="snap-start shrink-0">
            <Select value={groupId} onValueChange={(v) => onGroupChange((v ?? 'all') as 'all' | string)}>
              <SelectTrigger size="sm" className={chipTriggerClass(groupId !== 'all')} aria-label="Grupo">
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                  <span className="shrink-0 text-muted-foreground">Grupo</span>
                  <span className="shrink-0 text-foreground">:</span>
                  <SelectValue placeholder="Todos" className="min-w-0 flex-1 truncate">
                    {groupChipLabel ?? undefined}
                  </SelectValue>
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="Todos">
                  Todos
                </SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id} label={g.name}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>

            <div className="snap-start shrink-0">
            <Select
              value={matchStatus}
              onValueChange={(v) => onMatchStatusChange((v ?? 'all') as TournamentDashboardMatchStatusFilter)}
            >
              <SelectTrigger
                size="sm"
                className={chipTriggerClass(matchStatus !== 'all')}
                aria-label="Estado del partido"
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                  <span className="shrink-0 text-muted-foreground">Estado</span>
                  <span className="shrink-0 text-foreground">:</span>
                  <SelectValue placeholder="Todos" className="min-w-0 flex-1 truncate">
                    {matchStatusChipLabel ?? undefined}
                  </SelectValue>
                </span>
              </SelectTrigger>
              <SelectContent>
                {MATCH_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} label={o.label}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 md:w-auto md:justify-end md:border-t-0 md:pt-0">
            {isFetching ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                <span
                  className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-emerald-600 dark:border-t-emerald-400"
                  aria-hidden
                />
                Actualizando
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={clearButtonClass()}
              disabled={!filtersActive}
              onClick={onClearFilters}
            >
              Limpiar
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Categoría: acota métricas, ranking y lista de grupos a una división.
        </p>
      </CardContent>
    </Card>
  )
}
