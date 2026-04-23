import { useQuery } from '@tanstack/react-query'
import { BarChart3, ChevronRight, LayoutGrid, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { GlobalLeaderboardTable } from '@/components/home/GlobalLeaderboardTable'
import { RankingTable } from '@/components/ranking/RankingTable'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { isAdminRole } from '@/lib/permissions'
import { buildGlobalLeaderboard, getRecentMatchResults } from '@/services/home'
import { listGroupPlayers, listGroups } from '@/services/groups'
import { listMatchesForGroup } from '@/services/matches'
import { getTournamentRules, listTournaments } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import { computeGroupRanking } from '@/utils/ranking'

const shortDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

export function DashboardPage() {
  const profile = useAuthStore((s) => s.profile)
  const session = useAuthStore((s) => s.session)
  const userId = useAuthStore((s) => s.user?.id ?? null)

  const tq = useQuery({ queryKey: ['tournaments'], queryFn: listTournaments })
  const tournaments = useMemo(() => tq.data ?? [], [tq.data])

  const defaultTournamentId = useMemo(() => {
    const active = tournaments.find((t) => t.status === 'active')
    return active?.id ?? tournaments[0]?.id ?? null
  }, [tournaments])

  const [pickedTournamentId, setPickedTournamentId] = useState<string | null>(null)
  const [pickedGroupId, setPickedGroupId] = useState<string | null>(null)

  const effectiveTournamentId = pickedTournamentId ?? defaultTournamentId

  const gq = useQuery({
    queryKey: ['groups', effectiveTournamentId],
    queryFn: () => listGroups(effectiveTournamentId!),
    enabled: Boolean(effectiveTournamentId),
  })

  const groups = useMemo(() => gq.data ?? [], [gq.data])
  const effectiveGroupId = useMemo(() => {
    if (pickedGroupId && groups.some((g) => g.id === pickedGroupId)) {
      return pickedGroupId
    }
    return groups[0]?.id ?? null
  }, [pickedGroupId, groups])

  const rq = useQuery({
    queryKey: ['rules', effectiveTournamentId],
    queryFn: () => getTournamentRules(effectiveTournamentId!),
    enabled: Boolean(effectiveTournamentId),
  })

  const pq = useQuery({
    queryKey: ['groupPlayers', effectiveGroupId],
    queryFn: () => listGroupPlayers(effectiveGroupId!),
    enabled: Boolean(effectiveGroupId),
  })

  const mq = useQuery({
    queryKey: ['matches', effectiveGroupId],
    queryFn: () => listMatchesForGroup(effectiveGroupId!),
    enabled: Boolean(effectiveGroupId),
  })

  const rankingRows = useMemo(() => {
    if (!rq.data) return []
    const players = pq.data ?? []
    const matches = mq.data ?? []
    return computeGroupRanking(players, matches, rq.data)
  }, [rq.data, pq.data, mq.data])

  const recentQ = useQuery({
    queryKey: ['home', 'recent-matches'],
    queryFn: () => getRecentMatchResults(18),
  })

  const leaderboardQ = useQuery({
    queryKey: ['home', 'global-leaderboard'],
    queryFn: buildGlobalLeaderboard,
  })

  const selectedTournamentName = tournaments.find((t) => t.id === effectiveTournamentId)?.name
  const selectedGroupLabel = groups.find((g) => g.id === effectiveGroupId)?.name ?? null

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Inicio{profile?.full_name ? ` · ${profile.full_name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resultados recientes, clasificación por grupo y ranking global de la temporada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants()} to="/tournaments">
            Torneos
            <ChevronRight className="size-4 opacity-70" aria-hidden />
          </Link>
          {isAdminRole(profile?.role) ? (
            <Link className={buttonVariants({ variant: 'secondary' })} to="/admin">
              Admin
            </Link>
          ) : null}
        </div>
      </div>

      {!session ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Vista pública.</span> Resultados y rankings visibles sin
          iniciar sesión.{' '}
          <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/login">
            Entrar
          </Link>{' '}
          para administrar torneos y partidos.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutGrid className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg">Últimos resultados</CardTitle>
              <CardDescription>
                Partidos con marcador confirmado, más recientes primero.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {recentQ.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : recentQ.isError ? (
              <p className="text-sm text-destructive">No se pudieron cargar los resultados.</p>
            ) : (recentQ.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay partidos cerrados. Entra en un torneo y registra marcadores.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {recentQ.data?.map((r) => (
                  <li key={r.matchId}>
                    <Link
                      to={`/tournaments/${r.tournamentId}`}
                      className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{r.tournamentName}</span>
                          <Badge variant="secondary" className="text-xs font-normal">
                            {shortDateTime(r.updatedAt)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="text-foreground">{r.playerAName}</span>
                          {' vs '}
                          <span className="text-foreground">{r.playerBName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Ganador: <span className="font-medium text-foreground">{r.winnerName}</span>
                          {' · '}
                          <span className="tabular-nums">{r.scoreLabel}</span>
                        </p>
                      </div>
                      <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <BarChart3 className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg">Clasificación del grupo</CardTitle>
              <CardDescription>
                Tabla del grupo (misma lógica que en el detalle del torneo).
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tq.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : tournaments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay torneos todavía.</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dash-tournament">Torneo</Label>
                    <Select
                      value={effectiveTournamentId ?? ''}
                      onValueChange={(v) => {
                        setPickedTournamentId(v)
                        setPickedGroupId(null)
                      }}
                    >
                      <SelectTrigger id="dash-tournament" className="w-full min-w-0">
                        <SelectValue placeholder="Torneo">
                          {selectedTournamentName ?? null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {tournaments.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dash-group">Grupo</Label>
                    <Select
                      value={effectiveGroupId ?? ''}
                      onValueChange={(v) => setPickedGroupId(v)}
                      disabled={!effectiveTournamentId || groups.length === 0}
                    >
                      <SelectTrigger id="dash-group" className="w-full min-w-0">
                        <SelectValue placeholder="Grupo">{selectedGroupLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {effectiveTournamentId && selectedTournamentName ? (
                  <p className="text-xs text-muted-foreground">
                    <Link
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      to={`/tournaments/${effectiveTournamentId}`}
                    >
                      Abrir {selectedTournamentName}
                    </Link>
                  </p>
                ) : null}
                {gq.isLoading || pq.isLoading || mq.isLoading || rq.isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : !effectiveGroupId ? (
                  <p className="text-sm text-muted-foreground">Este torneo no tiene grupos aún.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <RankingTable rows={rankingRows} />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-400">
              <Trophy className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg">Leaderboard global</CardTitle>
              <CardDescription>
                Puntos acumulados en todos los torneos (prioriza torneos activos y recientes).
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {leaderboardQ.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : leaderboardQ.isError ? (
              <p className="text-sm text-destructive">No se pudo cargar el ranking global.</p>
            ) : (
              <GlobalLeaderboardTable rows={leaderboardQ.data ?? []} highlightUserId={userId} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
