import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { GroupProgressCard } from '@/components/dashboard/GroupProgressCard'
import { RecentMatchesCard } from '@/components/dashboard/RecentMatchesCard'
import { TournamentDashboardHeaderCompact } from '@/components/dashboard/TournamentDashboardHeaderCompact'
import { TournamentFiltersBar } from '@/components/dashboard/TournamentFiltersBar'
import { TournamentLeaderboardCard } from '@/components/dashboard/TournamentLeaderboardCard'
import { TournamentPerformanceOverview } from '@/components/dashboard/TournamentPerformanceOverview'
import { ResultsMatrixCard } from '@/components/tournament-dashboard/ResultsMatrixCard'
import { Skeleton } from '@/components/ui/skeleton'
import {
  groupPlayersToSimPlayers,
  matchRowsToSimMatches,
  rankingRowsToGroupStandings,
} from '@/lib/realTournamentView'
import {
  getTournamentDashboardData,
  listTournamentOptionsForDashboard,
  recomputeTournamentDashboardPresentation,
} from '@/services/dashboard/tournamentDashboardService'
import { ensureDefaultGroupCategories, listGroupCategories } from '@/services/groupCategories'
import type { Tournament } from '@/types/database'
import { computeGroupRanking } from '@/utils/ranking'

function defaultTournamentId(tournaments: Tournament[]): string | null {
  const active = tournaments.find((t) => t.status === 'active')
  return active?.id ?? tournaments[0]?.id ?? null
}

export function TournamentDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tq = useQuery({ queryKey: ['tournament-dashboard-options'], queryFn: listTournamentOptionsForDashboard })
  const tournaments = useMemo(() => tq.data ?? [], [tq.data])

  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [groupCategoryId, setGroupCategoryId] = useState<'all' | 'none' | string>('all')
  const [groupId, setGroupId] = useState<'all' | string>('all')

  const tournamentId = useMemo(() => {
    if (!tq.isSuccess || tournaments.length === 0) return null
    const fromUrl = searchParams.get('tournament') ?? searchParams.get('torneo')
    if (fromUrl && tournaments.some((t) => t.id === fromUrl)) return fromUrl
    if (selectedTournamentId && tournaments.some((t) => t.id === selectedTournamentId)) return selectedTournamentId
    return defaultTournamentId(tournaments)
  }, [tq.isSuccess, tournaments, searchParams, selectedTournamentId])

  const categoriesQ = useQuery({
    queryKey: ['group-categories', 'dashboard', tournamentId],
    queryFn: async () => {
      await ensureDefaultGroupCategories(tournamentId!)
      return listGroupCategories(tournamentId!)
    },
    enabled: Boolean(tournamentId),
    staleTime: 30_000,
  })
  const groupCategories = categoriesQ.data ?? []

  const filters = useMemo(
    () => ({
      groupCategoryId,
      groupId,
    }),
    [groupCategoryId, groupId],
  )

  const baseFilters = useMemo(
    () => ({
      groupCategoryId: 'all' as const,
      groupId: 'all' as const,
    }),
    [],
  )

  const dq = useQuery({
    queryKey: ['tournament-dashboard', tournamentId],
    queryFn: async () => {
      const d = await getTournamentDashboardData(tournamentId!, baseFilters)
      if (!d) throw new Error('Torneo no encontrado')
      return d
    },
    enabled: Boolean(tournamentId),
  })

  const data = useMemo(() => {
    const raw = dq.data
    if (!raw) return raw

    const groups =
      groupCategoryId === 'all'
        ? raw.groups
        : groupCategoryId === 'none'
          ? raw.groups.filter((g) => !g.group_category_id)
          : raw.groups.filter((g) => g.group_category_id === groupCategoryId)

    const groupFromUrl = searchParams.get('group') ?? searchParams.get('grupo')
    const requestedGroupId = groupId !== 'all' ? groupId : groupFromUrl
    const defaultGroupId = groups[0]?.id ?? null
    const groupStillVisible = requestedGroupId ? groups.some((g) => g.id === requestedGroupId) : false
    const effectiveGroupId = groupStillVisible ? requestedGroupId : defaultGroupId
    const effectiveFilters = {
      ...filters,
      groupId: effectiveGroupId ?? ('all' as const),
    }
    const derived = recomputeTournamentDashboardPresentation({
      groups,
      groupPlayers: raw.groupPlayers,
      allMatches: raw.matches,
      rules: raw.rules,
      filters: effectiveFilters,
    })

    return { ...raw, groups, ...derived }
  }, [dq.data, filters, groupCategoryId, groupId, searchParams])

  const selectedGroupId = useMemo(() => {
    const groupFromUrl = searchParams.get('group') ?? searchParams.get('grupo')
    const requestedGroupId = groupId !== 'all' ? groupId : groupFromUrl
    if (!data?.groups.length) return 'all'
    if (!requestedGroupId || !data.groups.some((g) => g.id === requestedGroupId)) return data.groups[0]?.id ?? 'all'
    return requestedGroupId
  }, [data, groupId, searchParams])

  const leaderboardGroupTitle =
    selectedGroupId === 'all' ? 'general' : data?.groups.find((g) => g.id === selectedGroupId)?.name ?? 'Grupo'

  const matrixGroup = useMemo(() => {
    if (!data?.groups.length) return null
    if (selectedGroupId !== 'all') return data.groups.find((g) => g.id === selectedGroupId) ?? null
    return data.groups[0] ?? null
  }, [data, selectedGroupId])

  const matrixData = useMemo(() => {
    if (!data || !matrixGroup) return null
    const players = data.groupPlayers
      .filter((p) => p.group_id === matrixGroup.id)
      .sort((a, b) => a.seed_order - b.seed_order || a.display_name.localeCompare(b.display_name, 'es'))
    const matches = data.matches.filter((m) => m.group_id === matrixGroup.id)
    const ranking = computeGroupRanking(players, matches, data.rules)
    return {
      players: groupPlayersToSimPlayers(players, matrixGroup.id),
      matches: matchRowsToSimMatches(matches, matrixGroup.id),
      standings: rankingRowsToGroupStandings(players, ranking),
    }
  }, [data, matrixGroup])

  const clearDashboardFilters = () => {
    setGroupCategoryId('all')
    setGroupId('all')
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('group')
        n.delete('grupo')
        return n
      },
      { replace: true },
    )
  }

  if (tq.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  if (tournaments.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border/80 bg-card px-6 py-10 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">No hay torneo activo</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Cuando se active un torneo, aquí podrás consultar su desempeño general, ranking y avance por grupo.
        </p>
      </div>
    )
  }

  if (!tournamentId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    )
  }

  if (dq.isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-6 text-sm text-red-900">
        No se pudo cargar el dashboard. {dq.error instanceof Error ? dq.error.message : ''}
      </div>
    )
  }

  if (dq.isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    )
  }

  /** Solo refetch con datos ya mostrados; evita que `isFetching` quede enganchado en estados raros del observer. */
  const filtersBarShowRefreshing =
    dq.fetchStatus === 'fetching' && dq.status === 'success' && Boolean(dq.data)

  return (
    <div className="tdash-root space-y-5 pb-6 sm:space-y-6 sm:pb-8">
      <TournamentDashboardHeaderCompact tournament={data.tournament} />

      <TournamentFiltersBar
        tournaments={tournaments}
        tournamentId={tournamentId}
        groupCategories={groupCategories}
        groupCategoryId={groupCategoryId}
        groups={data.groups}
        groupId={selectedGroupId}
        defaultGroupId={data.groups[0]?.id ?? 'all'}
        isFetching={filtersBarShowRefreshing}
        onTournamentChange={(id) => {
          setSelectedTournamentId(id)
          setGroupCategoryId('all')
          setGroupId('all')
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev)
              n.set('tournament', id)
              n.delete('torneo')
              n.delete('group')
              n.delete('grupo')
              return n
            },
            { replace: true },
          )
        }}
        onGroupCategoryChange={(id) => {
          setGroupCategoryId(id)
          setGroupId('all')
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev)
              n.delete('group')
              n.delete('grupo')
              return n
            },
            { replace: true },
          )
        }}
        onGroupChange={(id) => {
          setGroupId(id)
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev)
              if (id === 'all') {
                n.delete('group')
                n.delete('grupo')
              } else {
                n.set('group', id)
                n.delete('grupo')
              }
              return n
            },
            { replace: true },
          )
        }}
        onClearFilters={clearDashboardFilters}
      />

      <TournamentPerformanceOverview metrics={data.metrics} />

      {matrixGroup && matrixData ? (
        <ResultsMatrixCard
          playerCount={matrixData.players.length}
          matchCount={matrixData.matches.length}
          players={matrixData.players}
          matches={matrixData.matches}
          standings={matrixData.standings}
        />
      ) : null}

      {/* Una columna hasta lg: evita leaderboard + progreso demasiado estrechos en tablet */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 xl:gap-6">
        <div className="min-w-0 lg:col-span-7 xl:col-span-8">
          <TournamentLeaderboardCard leaderboard={data.leaderboard} groupLabel={leaderboardGroupTitle} />
        </div>
        <div className="min-w-0 lg:col-span-5 xl:col-span-4">
          <GroupProgressCard items={data.groupProgress} />
        </div>
      </div>

      <div className="min-w-0">
        <RecentMatchesCard
          matches={data.recentMatches}
          noMatchesScheduled={data.metrics.matchesTotal === 0}
        />
      </div>
    </div>
  )
}
