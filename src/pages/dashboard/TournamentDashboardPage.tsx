import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

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
import type { Group, Tournament } from '@/types/database'
import type { GroupStandingRow, SimMatch, SimPlayer } from '@/types/tournament'
import { compareGroupsForPromotionTier } from '@/utils/nextTournamentPromotion'
import { computeGroupRanking } from '@/utils/ranking'

function defaultTournamentId(tournaments: Tournament[]): string | null {
  const active = tournaments.find((t) => t.status === 'active')
  return active?.id ?? tournaments[0]?.id ?? null
}

function sortDashboardGroups(groups: Group[]): Group[] {
  return [...groups].sort((a, b) =>
    compareGroupsForPromotionTier(
      { name: a.name, order_index: a.order_index ?? 0, players: [] },
      { name: b.name, order_index: b.order_index ?? 0, players: [] },
    ),
  )
}

function resolveDashboardGroupId(
  groupId: 'all' | string,
  searchParams: URLSearchParams,
  groups: Group[],
): 'all' | string {
  const groupFromUrl = searchParams.get('group') ?? searchParams.get('grupo')
  const requested = groupId !== 'all' ? groupId : groupFromUrl
  if (!requested || requested === 'all') return 'all'
  return groups.some((g) => g.id === requested) ? requested : 'all'
}

type GroupMatrixBoard = {
  groupId: string
  groupName: string
  playerCount: number
  matchCount: number
  players: SimPlayer[]
  matches: SimMatch[]
  standings: GroupStandingRow[]
}

export function TournamentDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tq = useQuery({
    queryKey: ['tournament-dashboard-options'],
    queryFn: listTournamentOptionsForDashboard,
    staleTime: 5 * 60_000,
  })
  const tournaments = useMemo(() => tq.data ?? [], [tq.data])

  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<'all' | string>('all')

  const tournamentId = useMemo(() => {
    if (!tq.isSuccess || tournaments.length === 0) return null
    const fromUrl = searchParams.get('tournament') ?? searchParams.get('torneo')
    if (fromUrl && tournaments.some((t) => t.id === fromUrl)) return fromUrl
    if (selectedTournamentId && tournaments.some((t) => t.id === selectedTournamentId)) return selectedTournamentId
    return defaultTournamentId(tournaments)
  }, [tq.isSuccess, tournaments, searchParams, selectedTournamentId])

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
    staleTime: 90_000,
  })

  const sortedGroups = useMemo(() => sortDashboardGroups(dq.data?.groups ?? []), [dq.data?.groups])

  const selectedGroupId = useMemo(
    () => resolveDashboardGroupId(groupId, searchParams, sortedGroups),
    [groupId, searchParams, sortedGroups],
  )

  const data = useMemo(() => {
    const raw = dq.data
    if (!raw) return raw

    const groups = sortDashboardGroups(raw.groups)
    const effectiveFilters = {
      groupCategoryId: 'all' as const,
      groupId: selectedGroupId,
    }
    const derived = recomputeTournamentDashboardPresentation({
      groups,
      groupPlayers: raw.groupPlayers,
      allMatches: raw.matches,
      rules: raw.rules,
      filters: effectiveFilters,
    })

    return { ...raw, groups, ...derived }
  }, [dq.data, selectedGroupId])

  const leaderboardGroupTitle =
    selectedGroupId === 'all'
      ? 'general'
      : data?.groups.find((g) => g.id === selectedGroupId)?.name ?? 'Grupo'

  const matrixBoards = useMemo((): GroupMatrixBoard[] => {
    if (!data) return []
    const targetGroups =
      selectedGroupId === 'all'
        ? sortedGroups
        : sortedGroups.filter((g) => g.id === selectedGroupId)

    return targetGroups.map((group) => {
      const players = data.groupPlayers
        .filter((p) => p.group_id === group.id)
        .sort((a, b) => a.seed_order - b.seed_order || a.display_name.localeCompare(b.display_name, 'es'))
      const matches = data.matches.filter((m) => m.group_id === group.id)
      const ranking = computeGroupRanking(players, matches, data.rules)
      return {
        groupId: group.id,
        groupName: group.name,
        playerCount: players.length,
        matchCount: matches.length,
        players: groupPlayersToSimPlayers(players, group.id),
        matches: matchRowsToSimMatches(matches, group.id),
        standings: rankingRowsToGroupStandings(players, ranking),
      }
    })
  }, [data, selectedGroupId, sortedGroups])

  const clearDashboardFilters = () => {
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
          Cuando se active un torneo, aquí podrás consultar su desempeño general, ranking y cuadros de resultados.
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
      <TournamentDashboardHeaderCompact
        tournament={data.tournament}
        stats={{
          playerCount: data.metrics.totalPlayers,
          groupCount: data.metrics.totalGroups,
        }}
      />

      <TournamentFiltersBar
        tournaments={tournaments}
        tournamentId={tournamentId}
        groups={data.groups}
        groupId={selectedGroupId}
        isFetching={filtersBarShowRefreshing}
        onTournamentChange={(id) => {
          setSelectedTournamentId(id)
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

      <TournamentLeaderboardCard leaderboard={data.leaderboard} groupLabel={leaderboardGroupTitle} />

      {matrixBoards.length > 0 ? (
        <div className="space-y-5 sm:space-y-6">
          {matrixBoards.map((board) => (
            <ResultsMatrixCard
              key={board.groupId}
              groupName={board.groupName}
              playerCount={board.playerCount}
              matchCount={board.matchCount}
              players={board.players}
              matches={board.matches}
              standings={board.standings}
            />
          ))}
        </div>
      ) : null}

      <RecentMatchesCard
        matches={data.recentMatches}
        noMatchesScheduled={data.metrics.matchesTotal === 0}
      />
    </div>
  )
}
