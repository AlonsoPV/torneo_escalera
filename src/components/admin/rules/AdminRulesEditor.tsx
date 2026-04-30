import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormProvider, useForm, type Resolver } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formValuesToRulesUpdate,
  rulesRowToFormValues,
  tournamentRulesFormSchema,
  type TournamentRulesFormValues,
} from '@/domain/tournamentRulesForm'
import { tournamentPath } from '@/lib/tournamentUrl'
import { cn } from '@/lib/utils'
import {
  getTournamentRules,
  resetTournamentRulesToDefault,
  updateTournamentRules,
  type TournamentRulesUpdatePayload,
} from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { Tournament, TournamentRules } from '@/types/database'

import { RulesActionsBar } from './RulesActionsBar'
import { MatchRulesCard } from './MatchRulesCard'
import { RulesDefaultWorkflowCard } from './RulesDefaultWorkflowCard'
import { RulesPreviewCard } from './RulesPreviewCard'
import { RulesRankingCard } from './RulesRankingCard'
import { RulesScoringCard } from './RulesScoringCard'
import { RulesSummaryCard } from './RulesSummaryCard'

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
    <div
      id="card-admin-rules-status"
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estado del torneo</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{tournament.status}</p>
          <p className="mt-1 text-sm text-slate-600">Publica el torneo para que los jugadores puedan verlo y jugarlo.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            id="admin-rules-btn-publish"
            type="button"
            variant="secondary"
            className="h-11 w-full sm:w-auto"
            disabled={publishing || tournament.status === 'active'}
            onClick={onPublish}
          >
            Marcar como activo
          </Button>
          <Link
            id={`admin-rules-link-public-${tournament.id}`}
            data-name="viewPublicTournament"
            className={cn(buttonVariants({ variant: 'outline' }), 'h-11 justify-center')}
            to={tournamentPath(tournament)}
          >
            Ver detalle público
          </Link>
        </div>
      </div>
    </div>
  )
}

export function AdminRulesEditor({
  tournament,
  tournaments,
  onTournamentChange,
  onPublish,
  publishing,
}: {
  tournament: Tournament
  tournaments: Tournament[]
  onTournamentChange: (id: string) => void
  onPublish: () => void
  publishing: boolean
}) {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const tournamentId = tournament.id

  const rulesQ = useQuery({
    queryKey: ['rules', tournamentId],
    queryFn: () => getTournamentRules(tournamentId),
    enabled: Boolean(tournamentId),
  })

  if (rulesQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (rulesQ.isError || !rulesQ.data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/60 p-6 text-sm text-red-900">
        No se pudieron cargar las reglas de este torneo. Revisa permisos o conexión con Supabase.
      </div>
    )
  }

  return (
    <AdminRulesEditorLoaded
      tournament={tournament}
      tournaments={tournaments}
      onTournamentChange={onTournamentChange}
      onPublish={onPublish}
      publishing={publishing}
      rulesRow={rulesQ.data}
      queryClient={qc}
      userId={userId}
      tournamentId={tournamentId}
    />
  )
}

function AdminRulesEditorLoaded({
  tournament,
  tournaments,
  onTournamentChange,
  onPublish,
  publishing,
  rulesRow,
  queryClient,
  userId,
  tournamentId,
}: {
  tournament: Tournament
  tournaments: Tournament[]
  onTournamentChange: (id: string) => void
  onPublish: () => void
  publishing: boolean
  rulesRow: TournamentRules
  queryClient: ReturnType<typeof useQueryClient>
  userId: string | null
  tournamentId: string
}) {
  const form = useForm<TournamentRulesFormValues>({
    resolver: zodResolver(tournamentRulesFormSchema) as Resolver<TournamentRulesFormValues>,
    values: rulesRowToFormValues(rulesRow),
  })

  const saveMut = useMutation({
    mutationFn: async (values: TournamentRulesFormValues) => {
      const patch = formValuesToRulesUpdate(values, userId) as TournamentRulesUpdatePayload
      await updateTournamentRules(tournamentId, patch)
    },
    onSuccess: async () => {
      toast.success('Reglas guardadas')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rules', tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al guardar reglas'),
  })

  const resetDefaultsMut = useMutation({
    mutationFn: async () => {
      await resetTournamentRulesToDefault(tournamentId)
    },
    onSuccess: async () => {
      toast.success('Reglas restauradas a valores recomendados')
      await queryClient.invalidateQueries({ queryKey: ['rules', tournamentId] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al restaurar reglas'),
  })

  const submit = form.handleSubmit((values: TournamentRulesFormValues) => saveMut.mutate(values))

  return (
    <div className="space-y-6 pb-28 xl:space-y-8 xl:pb-0">
      <AdminPageHeader
        eyebrow="Administración"
        title="Reglas del torneo"
        description="Configura la puntuación, criterios de ranking y condiciones de resultados para mantener una clasificación clara y justa."
        actions={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              disabled={saveMut.isPending || resetDefaultsMut.isPending}
              onClick={() => resetDefaultsMut.mutate()}
            >
              Restaurar reglas por defecto
            </Button>
            <Button type="button" className="h-11 w-full sm:w-auto" disabled={saveMut.isPending} onClick={() => void submit()}>
              Guardar cambios
            </Button>
          </div>
        }
      />

      <RulesSummaryCard
        tournament={tournament}
        tournaments={tournaments}
        onTournamentChange={onTournamentChange}
        rules={rulesRow}
      />

      <TournamentStatusPanel tournament={tournament} onPublish={onPublish} publishing={publishing} />

      <FormProvider {...form}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-7">
            <RulesScoringCard />
            <RulesDefaultWorkflowCard />
            <MatchRulesCard />
          </div>
          <div className="space-y-6 xl:col-span-5">
            <RulesRankingCard />
            <RulesPreviewCard />
          </div>
        </div>

        <RulesActionsBar
          onCancel={() => form.reset(rulesRowToFormValues(rulesRow))}
          onReset={() => resetDefaultsMut.mutate()}
          onSave={() => void submit()}
          saving={saveMut.isPending || resetDefaultsMut.isPending}
        />
      </FormProvider>
    </div>
  )
}
