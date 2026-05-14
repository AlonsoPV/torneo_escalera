import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { GroupProgressCard } from '@/components/dashboard/GroupProgressCard'
import { RecentMatchesCard } from '@/components/dashboard/RecentMatchesCard'
import { TournamentDashboardHeaderCompact } from '@/components/dashboard/TournamentDashboardHeaderCompact'
import { TournamentFiltersBar } from '@/components/dashboard/TournamentFiltersBar'
import { TournamentLeaderboardCard } from '@/components/dashboard/TournamentLeaderboardCard'
import { TournamentPerformanceOverview } from '@/components/dashboard/TournamentPerformanceOverview'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getTournamentDashboardData,
  listTournamentOptionsForDashboard,
  type TournamentDashboardMatchStatusFilter,
} from '@/services/dashboard/tournamentDashboardService'
import { ensureDefaultGroupCategories, listGroupCategories } from '@/services/groupCategories'
import type { Tournament } from '@/types/database'

function defaultTournamentId(tournaments: Tournament[]): string | null {
  const active = tournaments.find((t) => t.status === 'active')
  return active?.id ?? tournaments[0]?.id ?? null
}

export function TournamentDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tq = useQuery({ queryKey: ['tournament-dashboard-options'], queryFn: listTournamentOptionsForDashboard })
  const tournaments = tq.data ?? []

  const [tournamentId, setTournamentId] = useState<string | null>(null)
  const [groupCategoryId, setGroupCategoryId] = useState<'all' | 'none' | string>('all')
  const [groupId, setGroupId] = useState<'all' | string>('all')
  const [matchStatus, setMatchStatus] = useState<TournamentDashboardMatchStatusFilter>('all')

  useEffect(() => {
    if (!tq.isSuccess || tournaments.length === 0) return
    const fromUrl = searchParams.get('tournament') ?? searchParams.get('torneo')
    setTournamentId((prev) => {
      if (fromUrl && tournaments.some((t) => t.id === fromUrl)) {
        return fromUrl
      }
      if (prev && tournaments.some((t) => t.id === prev)) return prev
      return defaultTournamentId(tournaments)
    })
  }, [tq.isSuccess, tournaments, searchParams])

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

  useEffect(() => {
    setGroupCategoryId('all')
  }, [tournamentId])

  useEffect(() => {
    setGroupId('all')
  }, [tournamentId, groupCategoryId])

  const filters = useMemo(
    () => ({
      groupCategoryId,
      groupId,
      matchStatus,
    }),
    [groupCategoryId, groupId, matchStatus],
  )

  const dq = useQuery({
    queryKey: ['tournament-dashboard', tournamentId, filters],
    queryFn: async () => {
      const d = await getTournamentDashboardData(tournamentId!, filters)
      if (!d) throw new Error('Torneo no encontrado')
      return d
    },
    enabled: Boolean(tournamentId),
  })

  const data = dq.data

  useEffect(() => {
    const gid = searchParams.get('group') ?? searchParams.get('grupo')
    if (!gid || !data?.groups?.length || !tournamentId) return
    if (data.tournament.id !== tournamentId) return
    if (!data.groups.some((g) => g.id === gid)) return
    setGroupId(gid)
  }, [searchParams, data?.groups, data?.tournament?.id, tournamentId])

  const leaderboardGroupTitle =
    groupId === 'all' ? 'general' : data?.groups.find((g) => g.id === groupId)?.name ?? 'Grupo'

  const clearDashboardFilters = () => {
    setGroupCategoryId('all')
    setGroupId('all')
    setMatchStatus('all')
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
    return null
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
    <div className="space-y-6 pb-6 sm:space-y-6 sm:pb-8">
      <TournamentDashboardHeaderCompact tournament={data.tournament} />

      <TournamentFiltersBar
        tournaments={tournaments}
        tournamentId={tournamentId}
        groupCategories={groupCategories}
        groupCategoryId={groupCategoryId}
        groups={data.groups}
        groupId={groupId}
        matchStatus={matchStatus}
        isFetching={filtersBarShowRefreshing}
        onTournamentChange={(id) => setTournamentId(id)}
        onGroupCategoryChange={(id) => setGroupCategoryId(id)}
        onGroupChange={(id) => setGroupId(id)}
        onMatchStatusChange={setMatchStatus}
        onClearFilters={clearDashboardFilters}
      />

      <TournamentPerformanceOverview metrics={data.metrics} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-4 lg:gap-6">
        <div className="order-1 md:col-span-7 xl:col-span-8">
          <TournamentLeaderboardCard leaderboard={data.leaderboard} groupLabel={leaderboardGroupTitle} />
        </div>
        <div className="order-2 md:col-span-5 xl:col-span-4">
          <GroupProgressCard items={data.groupProgress} />
        </div>
      </div>

      <div className="order-3">
        <RecentMatchesCard
          matches={data.recentMatches}
          noMatchesScheduled={data.metrics.matchesTotal === 0}
        />
      </div>
    </div>
  )
}
