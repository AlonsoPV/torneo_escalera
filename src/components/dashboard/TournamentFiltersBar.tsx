import { Filter, X } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Group, GroupCategory, Tournament } from '@/types/database'
import { compareGroupsForPromotionTier } from '@/utils/nextTournamentPromotion'

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
    'h-10 w-full min-w-0 touch-manipulation rounded-lg border border-[var(--tdash-border)] bg-[var(--tdash-surface)] px-3 text-sm shadow-none transition-colors',
    'hover:border-emerald-600/35 hover:bg-[var(--tdash-surface-2)]',
    'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none',
    '*:data-[slot=select-value]:font-semibold *:data-[slot=select-value]:text-[var(--tdash-text)]',
    '[&>[data-slot=select-value]]:min-w-0 [&_svg]:size-4',
    active && 'border-emerald-600/45 bg-emerald-500/[0.07] ring-1 ring-emerald-500/20',
  )
}

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[var(--tdash-muted)]">
      {children}
    </span>
  )
}

export function TournamentFiltersBar({
  tournaments,
  tournamentId,
  groupCategories,
  groupCategoryId,
  groups,
  groupId,
  defaultGroupId,
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
  defaultGroupId?: 'all' | string
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
      [...groups].sort((a, b) =>
        compareGroupsForPromotionTier(
          { name: a.name, order_index: a.order_index ?? 0, players: [] },
          { name: b.name, order_index: b.order_index ?? 0, players: [] },
        ),
      ),
    [groups],
  )

  const defaultSelectedGroupId = defaultGroupId ?? sortedGroups[0]?.id ?? 'all'
  const filtersActive = groupCategoryId !== 'all' || groupId !== defaultSelectedGroupId

  const tournamentLabel = sortedTournaments.find((t) => t.id === tournamentId)?.name ?? '-'

  const categoryTriggerLabel =
    groupCategoryId === 'all'
      ? 'Todas'
      : groupCategoryId === 'none'
        ? 'Sin categoria'
        : sortedCategories.find((c) => c.id === groupCategoryId)?.name ?? 'Todas'

  const groupTriggerLabel = groupId === 'all' ? 'Todos' : sortedGroups.find((g) => g.id === groupId)?.name ?? 'Todos'

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/65 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-700">
            <Filter className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-[var(--tdash-text)]">
              Filtros del torneo
            </h2>
            <p className="truncate text-xs text-[var(--tdash-muted)]">
              {tournamentLabel} / {categoryTriggerLabel} / {groupTriggerLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 md:justify-end">
          {isFetching ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--tdash-muted)]" aria-live="polite">
              <span
                className="size-3 animate-spin rounded-full border-2 border-[var(--tdash-muted)]/20 border-t-emerald-600"
                aria-hidden
              />
              Actualizando
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1 rounded-lg border-[var(--tdash-border)] bg-[var(--tdash-surface)] px-2 text-xs touch-manipulation"
            disabled={!filtersActive}
            onClick={onClearFilters}
          >
            <X className="size-3 shrink-0 opacity-70" aria-hidden />
            Restablecer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 md:p-4 xl:grid-cols-12">
        <div className="min-w-0 sm:col-span-2 xl:col-span-5">
          <FieldLabel>Torneo</FieldLabel>
          <Select
            value={tournamentId}
            onValueChange={(v) => {
              if (v) onTournamentChange(v)
            }}
          >
            <SelectTrigger
              className={selectTriggerClass(false)}
              aria-label={`Torneo: ${tournamentLabel}`}
              title={tournamentLabel}
            >
              <SelectValue placeholder="Torneo">{tournamentLabel}</SelectValue>
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

        <div className="min-w-0 xl:col-span-3">
          <FieldLabel>Categoria</FieldLabel>
          <Select
            value={groupCategoryId}
            onValueChange={(v) => onGroupCategoryChange((v ?? 'all') as 'all' | 'none' | string)}
          >
            <SelectTrigger
              className={selectTriggerClass(groupCategoryId !== 'all')}
              aria-label={`Categoria: ${categoryTriggerLabel}`}
            >
              <SelectValue placeholder="Categoria">{categoryTriggerLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Todas">
                Todas
              </SelectItem>
              <SelectItem value="none" label="Sin categoria">
                Sin categoria
              </SelectItem>
              {sortedCategories.map((c) => (
                <SelectItem key={c.id} value={c.id} label={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 xl:col-span-4">
          <FieldLabel>Grupo</FieldLabel>
          <Select value={groupId} onValueChange={(v) => onGroupChange((v ?? 'all') as 'all' | string)}>
            <SelectTrigger
              className={selectTriggerClass(groupId !== defaultSelectedGroupId)}
              aria-label={`Grupo: ${groupTriggerLabel}`}
            >
              <SelectValue placeholder="Grupo">{groupTriggerLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sortedGroups.map((g) => (
                <SelectItem key={g.id} value={g.id} label={g.name}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  )
}
