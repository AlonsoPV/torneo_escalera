import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, ListChecks, RotateCcw, Save, Settings2, ShieldCheck, Swords, Trophy } from 'lucide-react'
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

const rulesNavItems = [
  { href: '#card-rules-scoring', label: 'Puntos', icon: Trophy },
  { href: '#card-rules-defaults', label: 'Defaults', icon: ShieldCheck },
  { href: '#card-rules-match', label: 'Partido', icon: Swords },
  { href: '#card-rules-ranking', label: 'Ranking', icon: ListChecks },
  { href: '#card-rules-preview', label: 'Vista previa', icon: Eye },
] as const

function RulesOperationsPanel({
  status,
  isDirty,
  saving,
  onReset,
  onSave,
}: {
  status: Tournament['status']
  isDirty: boolean
  saving: boolean
  onReset: () => void
  onSave: () => void
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1.4fr_auto]">
        <div className="border-b border-slate-100 p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Panel de control</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <Settings2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">Reglas operativas</p>
              <p className="text-xs leading-relaxed text-slate-500">Ajusta, revisa el impacto y guarda en una sola pantalla.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-4 sm:grid-cols-3 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Torneo</p>
            <p className="mt-1 text-sm font-bold capitalize text-slate-950">{status}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cambios</p>
            <p className="mt-1 text-sm font-bold text-slate-950">{isDirty ? 'Sin guardar' : 'Al día'}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 sm:col-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Flujo</p>
            <p className="mt-1 text-sm font-bold text-emerald-950">Configurar → Probar → Guardar</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:p-5 lg:min-w-[15rem] lg:flex-col lg:justify-center">
          <Button type="button" className="h-11 w-full justify-center" disabled={saving} onClick={onSave}>
            <Save className="size-4" />
            Guardar
          </Button>
          <Button type="button" variant="outline" className="h-11 w-full justify-center" disabled={saving} onClick={onReset}>
            <RotateCcw className="size-4" />
            Restaurar
          </Button>
        </div>
      </div>
    </section>
  )
}

function RulesQuickNav() {
  return (
    <nav className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm" aria-label="Secciones de reglas">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {rulesNavItems.map((item) => {
          const Icon = item.icon
          return (
            <a
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
            </a>
          )
        })}
      </div>
    </nav>
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
      />

      <FormProvider {...form}>
        <RulesOperationsPanel
          status={tournament.status}
          isDirty={form.formState.isDirty}
          saving={saveMut.isPending || resetDefaultsMut.isPending}
          onReset={() => resetDefaultsMut.mutate()}
          onSave={() => void submit()}
        />

        <RulesQuickNav />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_25rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="space-y-6">
            <RulesScoringCard />
            <RulesDefaultWorkflowCard />
            <MatchRulesCard />
            <RulesRankingCard />
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <RulesSummaryCard
              tournament={tournament}
              tournaments={tournaments}
              onTournamentChange={onTournamentChange}
              rules={rulesRow}
            />
            <TournamentStatusPanel tournament={tournament} onPublish={onPublish} publishing={publishing} />
            <RulesPreviewCard />
          </aside>
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
