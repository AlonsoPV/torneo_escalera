import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  Grid3x3,
  Settings2,
  Trophy,
} from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { TournamentAdminPanel } from '@/components/tournaments/TournamentAdminPanel'
import { GroupVerticalPicker } from '@/components/groups/GroupVerticalPicker'
import { GroupMatrix } from '@/components/matches/GroupMatrix'
import { MatchScoreSheet } from '@/components/matches/MatchScoreSheet'
import { RankingTable } from '@/components/ranking/RankingTable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isAdminRole } from '@/lib/permissions'
import { listGroupPlayers, listGroups } from '@/services/groups'
import { listMatchesForGroup, saveMatchScore } from '@/services/matches'
import { getTournament, getTournamentRules } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { MatchRow } from '@/types/database'
import { computeGroupRanking } from '@/utils/ranking'

import { TournamentMatrixMock } from '@/components/tournaments/TournamentMatrixMock'
import { cn } from '@/lib/utils'

function statusBadgeClass(status: string) {
  switch (status) {
    case 'active':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
    case 'finished':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100'
    case 'draft':
    default:
      return 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100'
  }
}

export function TournamentDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const groupFromQuery = searchParams.get('group')
  const tournamentId = id ?? ''
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const isAdmin = isAdminRole(profile?.role)

  const tq = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => getTournament(tournamentId),
    enabled: Boolean(tournamentId),
  })

  const gq = useQuery({
    queryKey: ['groups', tournamentId],
    queryFn: () => listGroups(tournamentId),
    enabled: Boolean(tournamentId),
  })

  const rq = useQuery({
    queryKey: ['rules', tournamentId],
    queryFn: () => getTournamentRules(tournamentId),
    enabled: Boolean(tournamentId),
  })

  const groups = useMemo(() => gq.data ?? [], [gq.data])
  const [pickedGroupId, setPickedGroupId] = useState<string | null>(null)

  useEffect(() => {
    if (groupFromQuery && groups.some((g) => g.id === groupFromQuery)) {
      setPickedGroupId(groupFromQuery)
    }
  }, [groupFromQuery, groups])

  const effectiveGroupId = pickedGroupId ?? groups[0]?.id ?? null

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

  const players = useMemo(() => pq.data ?? [], [pq.data])
  const matches = useMemo(() => mq.data ?? [], [mq.data])

  const rankingRows = useMemo(() => {
    if (!rq.data) return []
    return computeGroupRanking(players, matches, rq.data)
  }, [players, matches, rq.data])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeMatch, setActiveMatch] = useState<MatchRow | null>(null)

  const refreshGroup = async () => {
    await qc.invalidateQueries({ queryKey: ['groupPlayers'] })
    await qc.invalidateQueries({ queryKey: ['matches'] })
    await qc.invalidateQueries({ queryKey: ['groups', tournamentId] })
    await qc.invalidateQueries({ queryKey: ['tournament', tournamentId] })
    await qc.invalidateQueries({ queryKey: ['rules', tournamentId] })
  }

  const onOpenMatch = (match: MatchRow | null) => {
    if (!match) {
      toast.error('Aún no existe el partido. Genera los cruces desde Admin.')
      return
    }
    setActiveMatch(match)
    setSheetOpen(true)
  }

  const onSaveScore = async (sets: { a: number; b: number }[]) => {
    if (!activeMatch || !userId) return
    try {
      await saveMatchScore({
        match: activeMatch,
        sets,
        actorUserId: userId,
        isAdmin,
      })
      toast.success('Marcador guardado')
      await refreshGroup()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
      throw e
    }
  }

  if (!tournamentId) {
    return <p className="text-sm text-muted-foreground">Torneo no encontrado.</p>
  }

  if (tq.isLoading || gq.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <Skeleton className="h-11 w-full max-w-xl rounded-lg" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  if (tq.isError || !tq.data) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No disponible</CardTitle>
            <CardDescription>
              No pudimos cargar este torneo. Puede que no exista o no tengas permisos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              to="/tournaments"
            >
              Volver a torneos
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const tournament = tq.data
  const selectedGroup = groups.find((g) => g.id === effectiveGroupId)

  const tabTriggerClass =
    'gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-muted-foreground shadow-none data-active:border-primary data-active:bg-transparent data-active:text-foreground data-active:shadow-none sm:px-4'

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="space-y-4 border-b border-border/80 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn('uppercase tracking-wide', statusBadgeClass(tournament.status))}
          >
            {tournament.status}
          </Badge>
          {tournament.category ? (
            <Badge variant="secondary" className="font-normal">
              {tournament.category}
            </Badge>
          ) : null}
          {tournament.season ? (
            <span className="text-xs text-muted-foreground">Temporada {tournament.season}</span>
          ) : null}
        </div>
        <div className="space-y-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {tournament.name}
          </h1>
          {tournament.description ? (
            <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              {tournament.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Matriz de resultados, ranking y reglas del formato de juego.
            </p>
          )}
        </div>
      </header>

      <Tabs defaultValue="vista" className="w-full">
        <TabsList
          variant="line"
          className={cn(
            'mb-0 flex h-auto min-h-11 w-full flex-wrap justify-start gap-0 rounded-none border-b border-border bg-transparent p-0',
            isAdmin ? 'sm:grid sm:grid-cols-4 sm:flex-none' : 'sm:grid sm:grid-cols-3 sm:flex-none',
          )}
        >
          <TabsTrigger value="vista" className={tabTriggerClass}>
            <Grid3x3 className="size-4 shrink-0 opacity-70" aria-hidden />
            Vista
          </TabsTrigger>
          <TabsTrigger value="ranking" className={tabTriggerClass}>
            <Trophy className="size-4 shrink-0 opacity-70" aria-hidden />
            Ranking
          </TabsTrigger>
          <TabsTrigger value="reglas" className={tabTriggerClass}>
            <ClipboardList className="size-4 shrink-0 opacity-70" aria-hidden />
            Reglas
          </TabsTrigger>
          {isAdmin ? (
            <TabsTrigger value="admin" className={tabTriggerClass}>
              <Settings2 className="size-4 shrink-0 opacity-70" aria-hidden />
              Admin
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="vista" className="mt-6 space-y-4 outline-none">
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
              <CardTitle className="text-lg">Matriz del grupo</CardTitle>
              <CardDescription>
                Elige un grupo y toca una celda para ver o registrar el marcador. Desplaza la tabla
                en horizontal si hay muchos jugadores.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <aside className="lg:w-56 lg:shrink-0">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Grupo
                  </p>
                  <GroupVerticalPicker
                    groups={groups}
                    selectedId={effectiveGroupId}
                    onSelect={(gid) => setPickedGroupId(gid)}
                    layout="chips"
                    responsive
                  />
                  {selectedGroup ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Mostrando <span className="font-medium text-foreground">{selectedGroup.name}</span>
                      {selectedGroup.max_players != null ? (
                        <> · hasta {selectedGroup.max_players} jugadores</>
                      ) : null}
                    </p>
                  ) : null}
                </aside>
                <div className="min-w-0 flex-1">
                  {groups.length === 0 ? (
                    <TournamentMatrixMock />
                  ) : pq.isLoading || mq.isLoading ? (
                    <Skeleton className="h-64 w-full rounded-xl" />
                  ) : (
                    <div className="rounded-xl border bg-card/30 p-1 sm:p-2">
                      <GroupMatrix players={players} matches={matches} onOpenMatch={onOpenMatch} />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="mt-6 outline-none">
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
              <CardTitle className="text-lg">Clasificación</CardTitle>
              <CardDescription>
                Orden: puntos, partidos ganados, diferencia de sets y de games. Cambia de grupo con
                el mismo selector que en Vista.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <aside className="lg:w-56 lg:shrink-0">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Grupo
                  </p>
                  <GroupVerticalPicker
                    groups={groups}
                    selectedId={effectiveGroupId}
                    onSelect={(gid) => setPickedGroupId(gid)}
                    layout="chips"
                    responsive
                  />
                </aside>
                <div className="min-w-0 flex-1">
                  <RankingTable rows={rankingRows} />
                  <p className="mt-3 text-center text-[11px] text-muted-foreground sm:text-left">
                    PJ partidos jugados · PG ganados · PP perdidos · SF/SC sets · JF/JC games
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reglas" className="mt-6 outline-none">
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
              <CardTitle className="text-lg">Reglas del torneo</CardTitle>
              <CardDescription>
                Parámetros usados para validar marcadores y calcular puntos en el ranking.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {rq.isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : rq.data ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <RuleTile
                    label="Formato"
                    value={`Mejor de ${rq.data.best_of_sets} sets`}
                    hint="Número máximo de sets por partido"
                  />
                  <RuleTile
                    label="Games por set"
                    value={String(rq.data.set_points)}
                    hint="Mínimo de games para ganar un set (MVP)"
                  />
                  <RuleTile
                    label="Tiebreak"
                    value={rq.data.tiebreak_enabled ? 'Activado' : 'Desactivado'}
                    hint="Desempate entre sets (simplificado en MVP)"
                  />
                  <RuleTile
                    label="Puntos · victoria"
                    value={`+${rq.data.points_per_win}`}
                    hint="Por partido normal contabilizado en ranking"
                  />
                  <RuleTile
                    label="Puntos · derrota"
                    value={String(rq.data.points_per_loss)}
                    hint="Suma al perder un partido normal"
                  />
                  <RuleTile
                    label="Puntos · W/O ganador"
                    value={`+${rq.data.points_default_win ?? 2}`}
                    hint="Victoria por no presentación o default"
                  />
                  <RuleTile
                    label="Puntos · W/O perdedor"
                    value={String(rq.data.points_default_loss ?? -1)}
                    hint="Derrota por default"
                  />
                  <RuleTile
                    label="Captura por jugadores"
                    value={rq.data.allow_player_score_entry ? 'Permitida' : 'No'}
                    hint="Si está permitida, los jugadores del partido envían o corrigen desde la matriz (si hay hora de fin, aplica tras esa hora)"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay reglas cargadas.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="admin" className="mt-6 outline-none">
            <div className="rounded-xl border border-dashed border-primary/25 bg-primary/5 p-1 sm:p-2">
              <TournamentAdminPanel
                tournamentId={tournamentId}
                groups={groups}
                currentUserId={userId}
                onRefresh={refreshGroup}
              />
            </div>
          </TabsContent>
        ) : null}
      </Tabs>

      <MatchScoreSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        match={activeMatch}
        players={players}
        rules={rq.data ?? null}
        currentUserId={userId}
        isAdmin={isAdmin}
        onSave={onSaveScore}
      />
    </div>
  )
}

function RuleTile(props: { label: string; value: string; hint: string }) {
  const { label, value, hint } = props
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-colors hover:border-primary/20 hover:bg-muted/20">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{hint}</p>
    </div>
  )
}
