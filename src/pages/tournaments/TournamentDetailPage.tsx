import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
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
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (tq.isError || !tq.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No disponible</CardTitle>
          <CardDescription>
            No pudimos cargar este torneo. Puede que no exista o no tengas permisos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" to="/tournaments">
            Volver a torneos
          </Link>
        </CardContent>
      </Card>
    )
  }

  const tournament = tq.data

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="uppercase">
            {tournament.status}
          </Badge>
          {tournament.category ? (
            <Badge variant="outline">{tournament.category}</Badge>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{tournament.name}</h1>
        {tournament.description ? (
          <p className="text-sm text-muted-foreground">{tournament.description}</p>
        ) : null}
      </div>

      <Tabs defaultValue="vista">
        <TabsList
          className={cn(
            'grid w-full',
            isAdmin ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3',
          )}
        >
          <TabsTrigger value="vista">Vista</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="reglas">Reglas</TabsTrigger>
          {isAdmin ? <TabsTrigger value="admin">Admin</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="vista" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grupos</CardTitle>
              <CardDescription>Un grupo a la vez · desplaza horizontal la matriz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GroupVerticalPicker
                groups={groups}
                selectedId={effectiveGroupId}
                onSelect={(gid) => setPickedGroupId(gid)}
              />

              {groups.length === 0 ? (
                <TournamentMatrixMock />
              ) : pq.isLoading || mq.isLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <GroupMatrix players={players} matches={matches} onOpenMatch={onOpenMatch} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ranking del grupo</CardTitle>
              <CardDescription>
                Orden: puntos, PG, diferencia de sets, diferencia de games.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GroupVerticalPicker
                groups={groups}
                selectedId={effectiveGroupId}
                onSelect={(gid) => setPickedGroupId(gid)}
              />
              <div className="mt-4 overflow-x-auto">
                <RankingTable rows={rankingRows} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reglas" className="pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reglas del torneo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {rq.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : rq.data ? (
                <ul className="space-y-1">
                  <li>Mejor de: {rq.data.best_of_sets} sets</li>
                  <li>Games por set: {rq.data.set_points}</li>
                  <li>Tiebreak (MVP simplificado): {rq.data.tiebreak_enabled ? 'sí' : 'no'}</li>
                  <li>Puntos por victoria: {rq.data.points_per_win}</li>
                  <li>Puntos por derrota: {rq.data.points_per_loss}</li>
                  <li>
                    Jugadores capturan marcador:{' '}
                    {rq.data.allow_player_score_entry ? 'sí' : 'no'}
                  </li>
                </ul>
              ) : (
                <p>No hay reglas cargadas.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="admin" className="pt-2">
            <TournamentAdminPanel
              tournamentId={tournamentId}
              groups={groups}
              currentUserId={userId}
              onRefresh={refreshGroup}
            />
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
