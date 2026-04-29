import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Settings2, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminFilterCard } from '@/components/admin/shared/AdminFilterCard'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { Skeleton } from '@/components/ui/skeleton'
import { tournamentPath } from '@/lib/tournamentUrl'
import { cn } from '@/lib/utils'
import { getTournamentRules, listTournaments, updateTournament, updateTournamentRules } from '@/services/tournaments'
import type { Tournament } from '@/types/database'

const rulesSchema = z.object({
  best_of_sets: z.coerce.number().refine((n) => [1, 3, 5].includes(n)),
  set_points: z.coerce.number().int().min(1),
  points_per_win: z.coerce.number().int().min(0),
  points_per_loss: z.coerce.number().int().min(0),
  points_default_win: z.coerce.number().int().min(0),
  points_default_loss: z.coerce.number().int().min(-10),
  allow_player_score_entry: z.boolean(),
})

type RulesForm = z.infer<typeof rulesSchema>

function defaultRules(): RulesForm {
  return {
    best_of_sets: 3,
    set_points: 6,
    points_per_win: 3,
    points_per_loss: 0,
    points_default_win: 2,
    points_default_loss: -1,
    allow_player_score_entry: true,
  }
}

function TournamentStatusPanel({
  tournament,
  onPublish,
  publishing,
}: {
  tournament: Tournament
  onPublish: () => void
  publishing: boolean
}) {
  return (
    <Card className="border-[#E2E8F0] bg-white shadow-sm">
      <CardHeader className="space-y-1.5 pb-2 sm:pb-3">
        <CardTitle className="text-[#102A43]">Estado del torneo</CardTitle>
        <CardDescription>Publica el torneo para que los jugadores puedan verlo y jugarlo.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="text-sm text-[#64748B]">Estado actual</p>
          <p className="mt-1.5 font-semibold text-[#102A43]">{tournament.status}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={publishing || tournament.status === 'active'}
            onClick={onPublish}
          >
            <ShieldCheck className="size-4" />
            Marcar como activo
          </Button>
          <Link className={cn(buttonVariants({ variant: 'outline' }), 'justify-center')} to={tournamentPath(tournament)}>
            Ver detalle público
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function RulesEditor({ tournamentId }: { tournamentId: string }) {
  const qc = useQueryClient()
  const rulesQ = useQuery({
    queryKey: ['rules', tournamentId],
    queryFn: () => getTournamentRules(tournamentId),
    enabled: Boolean(tournamentId),
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
      : defaultRules(),
  })

  const saveMut = useMutation({
    mutationFn: async (values: RulesForm) => {
      await updateTournamentRules(tournamentId, {
        best_of_sets: values.best_of_sets as 1 | 3 | 5,
        set_points: values.set_points,
        points_per_win: values.points_per_win,
        points_per_loss: values.points_per_loss,
        points_default_win: values.points_default_win,
        points_default_loss: values.points_default_loss,
        allow_player_score_entry: values.allow_player_score_entry,
      })
    },
    onSuccess: async () => {
      toast.success('Reglas actualizadas')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['rules', tournamentId] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al guardar reglas'),
  })

  const bestOfSets = rulesForm.watch('best_of_sets')
  const allowPlayerScoreEntry = rulesForm.watch('allow_player_score_entry')

  if (rulesQ.isLoading) return <Skeleton className="h-80 rounded-2xl" />
  if (rulesQ.isError) {
    return (
      <AdminEmptyState
        title="No se pudieron cargar las reglas."
        description={rulesQ.error instanceof Error ? rulesQ.error.message : 'Revisa permisos o conexión con Supabase.'}
        icon={Settings2}
      />
    )
  }

  return (
    <Card className="border-[#E2E8F0] bg-white shadow-sm">
      <CardHeader className="space-y-1.5 pb-2 sm:pb-3">
        <CardTitle className="text-[#102A43]">Reglas del torneo</CardTitle>
        <CardDescription>
          Misma configuración que antes estaba dentro del detalle del torneo: marcador, puntos y captura por jugadores.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form
          className="space-y-6 sm:space-y-7"
          onSubmit={rulesForm.handleSubmit((values) => saveMut.mutate(values))}
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
            <div className="space-y-2.5">
              <Label>Mejor de (sets)</Label>
              <Select
                value={String(bestOfSets)}
                onValueChange={(value) => rulesForm.setValue('best_of_sets', Number(value) as 1 | 3 | 5)}
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
            <div className="space-y-2.5">
              <Label>Games por set</Label>
              <Input type="number" {...rulesForm.register('set_points', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2.5">
              <Label>Puntos victoria</Label>
              <Input type="number" {...rulesForm.register('points_per_win', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2.5">
              <Label>Puntos derrota</Label>
              <Input type="number" {...rulesForm.register('points_per_loss', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2.5">
              <Label>Pts. W/O (ganador)</Label>
              <Input type="number" {...rulesForm.register('points_default_win', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2.5">
              <Label>Pts. W/O (perdedor)</Label>
              <Input type="number" {...rulesForm.register('points_default_loss', { valueAsNumber: true })} />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl bg-[#F8FAFC] px-5 py-4 text-sm text-[#102A43] sm:px-6 sm:py-5">
            <input
              type="checkbox"
              checked={allowPlayerScoreEntry}
              onChange={(event) => rulesForm.setValue('allow_player_score_entry', event.target.checked)}
            />
            Jugadores pueden capturar marcador
          </label>

          <Button type="submit" className="mt-1 w-full sm:w-auto" disabled={saveMut.isPending}>
            <Save className="size-4" />
            Guardar reglas
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function AdminRulesPage() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tournamentsQ = useQuery({ queryKey: ['admin-tournaments'], queryFn: listTournaments })
  const tournaments = tournamentsQ.data ?? []
  const selectedTournamentId = searchParams.get('tournament')
  const selectedTournament = useMemo(
    () =>
      tournaments.find((tournament) => tournament.id === selectedTournamentId) ??
      tournaments.find((tournament) => tournament.status !== 'finished') ??
      tournaments[0] ??
      null,
    [selectedTournamentId, tournaments],
  )
  const tournamentId = selectedTournament?.id ?? ''

  const publishMut = useMutation({
    mutationFn: async (id: string) => updateTournament(id, { status: 'active' }),
    onSuccess: async () => {
      toast.success('Torneo publicado como activo')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
        qc.invalidateQueries({ queryKey: ['tournaments'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al publicar torneo'),
  })

  return (
    <div className="space-y-8 sm:space-y-10">
      <AdminPageHeader
        eyebrow="Reglas"
        title="Reglas y publicación"
        description="Configura las reglas operativas del torneo desde el dashboard de administración."
      />

      {tournamentsQ.isLoading ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : tournaments.length === 0 || !selectedTournament ? (
        <AdminEmptyState
          title="Aún no hay torneos creados."
          description="Crea un torneo primero para poder configurar sus reglas."
          icon={Settings2}
        />
      ) : (
        <>
          <div className="flex flex-col gap-8 sm:gap-10">
            <AdminFilterCard>
            <Label className="mb-2 block text-sm font-medium text-[#102A43]">Torneo</Label>
            <Select
              value={tournamentId}
              onValueChange={(nextTournamentId) => {
                if (nextTournamentId) setSearchParams({ tournament: nextTournamentId }, { replace: true })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{selectedTournament.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tournaments.map((tournament) => (
                  <SelectItem key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </AdminFilterCard>

            <TournamentStatusPanel
              tournament={selectedTournament}
              publishing={publishMut.isPending}
              onPublish={() => publishMut.mutate(selectedTournament.id)}
            />
            <RulesEditor tournamentId={selectedTournament.id} />
          </div>
        </>
      )}
    </div>
  )
}
