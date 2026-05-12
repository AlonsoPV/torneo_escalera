import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { GroupMatchScheduleList } from '@/components/tournaments/GroupMatchScheduleList'
import { TournamentRoundRobinBulkCard } from '@/components/admin/groups/TournamentRoundRobinBulkCard'
import { addGroupPlayer, createGroup, listGroupPlayers } from '@/services/groups'
import { generateRoundRobinMatches, type GenerateRrMode } from '@/services/matches'
import { listProfilesForAdmin } from '@/services/profiles'
import {
  getTournamentRules,
  updateTournament,
  updateTournamentRules,
} from '@/services/tournaments'
import { getAdminGroups } from '@/services/admin'
import type { Group } from '@/types/database'

const rulesSchema = z.object({
  best_of_sets: z.coerce.number().refine((n) => [1, 3, 5].includes(n)),
  set_points: z.coerce.number().int().min(1),
  points_per_win: z.coerce.number().int().min(0),
  points_per_loss: z.coerce.number().int().min(-50),
  points_default_win: z.coerce.number().int().min(0),
  points_default_loss: z.coerce.number().int().min(-10),
  allow_player_score_entry: z.boolean(),
})

type RulesForm = z.infer<typeof rulesSchema>

const groupSchema = z.object({
  name: z.string().min(1),
})

export function TournamentAdminPanel(props: {
  tournamentId: string
  groups: Group[]
  onRefresh: () => Promise<void>
  currentUserId: string | null
}) {
  const { tournamentId, groups, onRefresh, currentUserId } = props
  const qc = useQueryClient()

  const rulesQ = useQuery({
    queryKey: ['rules', tournamentId],
    queryFn: () => getTournamentRules(tournamentId),
  })

  const adminGroupsQ = useQuery({
    queryKey: ['admin-groups'],
    queryFn: () => getAdminGroups(tournamentId),
    enabled: Boolean(tournamentId),
  })

  const profilesQ = useQuery({
    queryKey: ['profiles-admin'],
    queryFn: listProfilesForAdmin,
  })

  const rulesForm = useForm<RulesForm>({
    resolver: zodResolver(rulesSchema) as Resolver<RulesForm>,
    values: rulesQ.data
      ? {
          best_of_sets: rulesQ.data.best_of_sets,
          set_points: rulesQ.data.set_points,
          points_per_win: rulesQ.data.points_per_win,
          points_per_loss: rulesQ.data.points_per_loss,
          points_default_win: rulesQ.data.points_default_win,
          points_default_loss: rulesQ.data.points_default_loss,
          allow_player_score_entry: rulesQ.data.allow_player_score_entry,
        }
      : {
          best_of_sets: 3,
          set_points: 6,
          points_per_win: 3,
          points_per_loss: 0,
          points_default_win: 2,
          points_default_loss: -1,
          allow_player_score_entry: true,
        },
  })

  const groupForm = useForm<{ name: string }>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: '' },
  })

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    groups[0]?.id ?? null,
  )

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null
  const bestOfSets = rulesForm.watch('best_of_sets')

  useEffect(() => {
    if (!selectedGroupId && groups[0]?.id) setSelectedGroupId(groups[0].id)
  }, [groups, selectedGroupId])

  const playersQ = useQuery({
    queryKey: ['groupPlayers', selectedGroupId],
    queryFn: () => listGroupPlayers(selectedGroupId!),
    enabled: Boolean(selectedGroupId),
  })

  const assignForm = useForm<{ userId: string; displayName: string; seed: number }>({
    defaultValues: { userId: '', displayName: '', seed: 0 },
  })

  const assignUserId = assignForm.watch('userId')
  const selectedAssignProfile = profilesQ.data?.find((x) => x.id === assignUserId)
  const assignUserLabel =
    assignUserId && selectedAssignProfile
      ? (selectedAssignProfile.full_name ?? selectedAssignProfile.email ?? assignUserId)
      : null

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: ['tournament', tournamentId] })
    await qc.invalidateQueries({ queryKey: ['groups', tournamentId] })
    await qc.invalidateQueries({ queryKey: ['admin-groups'] })
    await qc.invalidateQueries({ queryKey: ['groupPlayers', selectedGroupId] })
    await qc.invalidateQueries({ queryKey: ['matches', selectedGroupId] })
    await qc.invalidateQueries({ queryKey: ['rules', tournamentId] })
    await onRefresh()
  }

  const onSaveRules = rulesForm.handleSubmit(async (values) => {
    try {
      await updateTournamentRules(tournamentId, {
        best_of_sets: values.best_of_sets as 1 | 3 | 5,
        set_points: values.set_points,
        points_per_win: values.points_per_win,
        points_per_loss: values.points_per_loss,
        points_default_win: values.points_default_win,
        points_default_loss: values.points_default_loss,
        allow_player_score_entry: values.allow_player_score_entry,
      })
      toast.success('Reglas actualizadas')
      await invalidateAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar reglas')
    }
  })

  const onCreateGroup = groupForm.handleSubmit(async (values) => {
    try {
      await createGroup({
        tournamentId,
        name: values.name,
        orderIndex: groups.length,
      })
      groupForm.reset({ name: '' })
      toast.success('Grupo creado')
      await invalidateAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear grupo')
    }
  })

  const onAssign = assignForm.handleSubmit(async (values) => {
    if (!selectedGroupId) return
    try {
      await addGroupPlayer({
        groupId: selectedGroupId,
        userId: values.userId,
        displayName: values.displayName || 'Jugador',
        seedOrder: values.seed,
      })
      assignForm.reset({ userId: '', displayName: '', seed: 0 })
      toast.success('Jugador asignado')
      await invalidateAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al asignar jugador')
    }
  })

  const onGenerate = async (mode: GenerateRrMode) => {
    if (!selectedGroupId) return
    const players = playersQ.data ?? []
    try {
      await generateRoundRobinMatches({
        tournamentId,
        groupId: selectedGroupId,
        players,
        createdBy: currentUserId,
        mode,
      })
      toast.success(
        mode === 'reset' ? 'Cruces regenerados (se borraron los anteriores)' : 'Cruces: solo pares faltantes',
      )
      await invalidateAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al generar cruces')
    }
  }

  const onPublish = async () => {
    try {
      await updateTournament(tournamentId, { status: 'active' })
      toast.success('Torneo publicado como activo')
      await invalidateAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al publicar')
    }
  }

  return (
    <div className="space-y-6">
      {adminGroupsQ.data?.length ? (
        <TournamentRoundRobinBulkCard
          tournamentId={tournamentId}
          groups={adminGroupsQ.data}
          currentUserId={currentUserId}
          disabled={adminGroupsQ.isFetching}
          variant="embed"
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Estado del torneo</CardTitle>
          <CardDescription>Publica el torneo para que sea visible según RLS.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onPublish}>
            Marcar como activo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas</CardTitle>
          <CardDescription>Validación básica del marcador (MVP).</CardDescription>
        </CardHeader>
        <CardContent>
          {rulesQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <form className="space-y-3" onSubmit={onSaveRules}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mejor de (sets)</Label>
                  <Select
                    value={String(rulesForm.watch('best_of_sets'))}
                    onValueChange={(v) =>
                      rulesForm.setValue('best_of_sets', Number(v) as 1 | 3 | 5)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>{String(bestOfSets)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Games por set</Label>
                  <Input type="number" {...rulesForm.register('set_points', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label>Puntos victoria</Label>
                  <Input
                    type="number"
                    {...rulesForm.register('points_per_win', { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label>Puntos derrota</Label>
                  <Input
                    type="number"
                    {...rulesForm.register('points_per_loss', { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label>Pts. W/O (ganador)</Label>
                  <Input
                    type="number"
                    {...rulesForm.register('points_default_win', { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label>Pts. W/O (perdedor)</Label>
                  <Input
                    type="number"
                    {...rulesForm.register('points_default_loss', { valueAsNumber: true })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="allow_player_score_entry"
                  type="checkbox"
                  checked={rulesForm.watch('allow_player_score_entry')}
                  onChange={(e) => rulesForm.setValue('allow_player_score_entry', e.target.checked)}
                />
                <Label htmlFor="allow_player_score_entry">Jugadores pueden capturar marcador</Label>
              </div>
              <Button type="submit" disabled={rulesForm.formState.isSubmitting}>
                Guardar reglas
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grupos</CardTitle>
          <CardDescription>Crea grupos y luego asigna jugadores.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={onCreateGroup}>
            <div className="flex-1">
              <Label>Nombre del grupo</Label>
              <Input placeholder="Grupo A" {...groupForm.register('name')} />
            </div>
            <Button type="submit" disabled={groupForm.formState.isSubmitting}>
              Crear
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jugadores y cruces</CardTitle>
          <CardDescription>
            Asigna perfiles existentes y genera los cruces round-robin del grupo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Grupo</Label>
            <Select
              value={selectedGroupId ?? ''}
              onValueChange={(v) => setSelectedGroupId(v)}
            >
              <SelectTrigger className="w-full min-w-0 max-w-md">
                <SelectValue placeholder="Selecciona grupo">
                  {selectedGroup ? selectedGroup.name : null}
                </SelectValue>
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

          <Separator />

          <form className="space-y-3" onSubmit={onAssign}>
            <div>
              <Label>Usuario</Label>
              <Select
                value={assignUserId}
                onValueChange={(id) => {
                  if (!id) return
                  assignForm.setValue('userId', id)
                  const p = profilesQ.data?.find((x) => x.id === id)
                  if (p) assignForm.setValue('displayName', p.full_name ?? p.email ?? '')
                }}
              >
                <SelectTrigger className="w-full min-w-0 max-w-md">
                  <SelectValue placeholder="Selecciona usuario">{assignUserLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(profilesQ.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name?.trim() || p.email?.trim() || 'Usuario sin nombre'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Nombre en grupo</Label>
                <Input {...assignForm.register('displayName')} />
              </div>
              <div>
                <Label>Seed</Label>
                <Input type="number" {...assignForm.register('seed', { valueAsNumber: true })} />
              </div>
            </div>
            <Button type="submit" disabled={assignForm.formState.isSubmitting}>
              Asignar jugador
            </Button>
          </form>

          <div>
            <p className="mb-2 text-sm font-medium">Jugadores actuales</p>
            {playersQ.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {(playersQ.data ?? []).map((p) => (
                  <li key={p.id}>
                    {p.display_name} · seed {p.seed_order}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => onGenerate('fill')}>
              Generar faltantes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onGenerate('reset')}
            >
              Regenerar (borra partidos)
            </Button>
          </div>
          {selectedGroupId ? (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">Cruces generados</p>
              <GroupMatchScheduleList
                groupId={selectedGroupId}
                tournamentId={tournamentId}
                currentUserId={currentUserId}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
