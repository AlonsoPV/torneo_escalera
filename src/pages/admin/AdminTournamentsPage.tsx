import { ArrowRightLeft, CheckCircle2, ChevronRight, Eye, Grid3x3, Lock, Pencil, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/shared/AdminDataTable'
import { CloseTournamentDialog } from '@/components/admin/tournaments/CloseTournamentDialog'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { AdminMetricCard, ADMIN_METRIC_GRID_4 } from '@/components/admin/shared/AdminMetricCard'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  clearAdminNextTournamentRouteAccess,
  grantAdminNextTournamentRouteAccess,
} from '@/lib/adminNextTournamentRouteGate'
import { cn } from '@/lib/utils'
import { getAdminOverviewData } from '@/services/admin'
import { listTournaments, updateTournament } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { Tournament, TournamentStatus } from '@/types/database'

function formatTournamentCreatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

function sortTournamentsByCreatedDesc(tournaments: Tournament[]): Tournament[] {
  return [...tournaments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

function canActivateTournament(status: TournamentStatus): boolean {
  return status === 'draft' || status === 'finished'
}

type NextTournamentHeaderActionProps = {
  disabled: boolean
}

function NextTournamentHeaderAction({ disabled }: NextTournamentHeaderActionProps) {
  const content = (
    <>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
          disabled
            ? 'bg-slate-100 text-slate-400 ring-slate-200'
            : 'bg-white/15 text-white ring-white/20',
        )}
        aria-hidden
      >
        {disabled ? <Lock className="size-4" /> : <ArrowRightLeft className="size-4" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left leading-tight">
        <span className={cn('text-sm font-semibold tracking-tight', disabled ? 'text-slate-600' : 'text-white')}>
          Crear siguiente torneo
        </span>
        <span className={cn('text-[11px] font-normal', disabled ? 'text-slate-500' : 'text-white/75')}>
          {disabled ? 'Cierra o activa el torneo abierto' : 'Ascensos, grupos y round robin'}
        </span>
      </span>
      {!disabled ? (
        <ChevronRight
          className="size-4 shrink-0 text-white/70 transition-transform group-hover/link:translate-x-0.5"
          aria-hidden
        />
      ) : null}
    </>
  )

  const className = cn(
    'group/link inline-flex min-h-11 w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left shadow-sm transition-all sm:w-auto sm:min-w-[15.5rem]',
    disabled
      ? 'cursor-not-allowed border-dashed border-slate-200 bg-slate-50/90 text-slate-500'
      : cn(
          buttonVariants({ variant: 'default', size: 'lg' }),
          'h-auto border-[#1F5A4C]/25 bg-gradient-to-br from-[#1F5A4C] to-[#174a3f] text-white shadow-md shadow-[#1F5A4C]/15',
          'hover:border-[#1F5A4C]/40 hover:from-[#236b5a] hover:to-[#1a5247] hover:shadow-lg hover:shadow-[#1F5A4C]/20',
        ),
  )

  if (disabled) {
    return (
      <span
        id="admin-tournaments-next-wizard-disabled"
        data-name="next-tournament-wizard-disabled"
        className={className}
        title="Finaliza el torneo abierto antes de crear el siguiente"
        role="status"
      >
        {content}
      </span>
    )
  }

  return (
    <Link
      id="admin-tournaments-link-next-wizard"
      data-name="link-next-tournament-wizard"
      to="/admin/next-tournament"
      className={className}
      onClick={() => grantAdminNextTournamentRouteAccess()}
    >
      {content}
    </Link>
  )
}

function RenameTournamentModal({
  tournament,
  onSave,
  saving,
  density = 'comfortable',
}: {
  tournament: Tournament
  onSave: (name: string) => Promise<void>
  saving: boolean
  density?: 'comfortable' | 'compact'
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(tournament.name)

  const compact = density === 'compact'

  return (
    <AdminFormModal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          id={`admin-tournament-btn-rename-${tournament.id}`}
          name={`rename-tournament-open-${tournament.id}`}
          variant="outline"
          size={compact ? 'icon-sm' : 'sm'}
          type="button"
          disabled={saving}
          title="Renombrar torneo"
          aria-label="Renombrar torneo"
          onClick={() => setName(tournament.name)}
        >
          <Pencil className="size-3.5" />
          {!compact ? <span>Renombrar</span> : null}
        </Button>
      }
      title="Renombrar torneo"
      description="Actualiza el nombre visible en listados, dashboard y ficha del torneo."
    >
      <form
        id={`form-admin-tournament-rename-${tournament.id}`}
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          const trimmed = name.trim()
          if (!trimmed) {
            toast.error('El nombre no puede estar vacío')
            return
          }
          try {
            await onSave(trimmed)
            setOpen(false)
          } catch {
            /* toast en el padre */
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`admin-tournament-rename-name-${tournament.id}`}>Nombre</Label>
          <Input
            id={`admin-tournament-rename-name-${tournament.id}`}
            name="renameTournamentName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoComplete="off"
            maxLength={200}
          />
        </div>
        <Button type="submit" id={`admin-tournament-rename-submit-${tournament.id}`} name={`rename-tournament-submit-${tournament.id}`} className="w-full" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar nombre'}
        </Button>
      </form>
    </AdminFormModal>
  )
}

function TournamentActionsToolbar({
  tournament,
  renameSaving,
  activateSaving,
  onRenameSave,
  onActivate,
  closedBy,
  layout,
}: {
  tournament: Tournament
  renameSaving: boolean
  activateSaving: boolean
  onRenameSave: (name: string) => Promise<void>
  onActivate: () => Promise<void>
  closedBy: string | undefined
  layout: 'table' | 'card'
}) {
  const finished = tournament.status === 'finished'
  const canActivate = canActivateTournament(tournament.status)

  if (layout === 'table') {
    return (
      <div
        role="toolbar"
        id={`admin-tournament-toolbar-${tournament.id}`}
        data-name={`tournament-toolbar-${tournament.id}`}
        aria-label={`Acciones del torneo ${tournament.name}`}
        className="flex flex-nowrap items-center gap-1 py-0.5"
      >
        <RenameTournamentModal
          tournament={tournament}
          saving={renameSaving}
          onSave={onRenameSave}
          density="compact"
        />
        <Link
          id={`admin-tournament-link-dashboard-${tournament.id}`}
          data-name={`viewDashboard-${tournament.id}`}
          to={`/dashboard?tournament=${encodeURIComponent(tournament.id)}`}
          title="Abrir torneo"
          aria-label="Abrir torneo"
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm', className: 'shrink-0 text-slate-600' })}
        >
          <Eye className="size-3.5" />
        </Link>
        {canActivate ? (
          <Button
            id={`admin-tournament-btn-activate-${tournament.id}`}
            name={`activateTournament-${tournament.id}`}
            variant="outline"
            size="icon-sm"
            type="button"
            disabled={activateSaving}
            title="Activar torneo"
            aria-label="Activar torneo"
            className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={() => void onActivate()}
          >
            <CheckCircle2 className="size-3.5" />
          </Button>
        ) : null}
        <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-slate-200 sm:inline-block" aria-hidden />
        <CloseTournamentDialog
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          closedBy={closedBy}
          trigger={
            <Button
              id={`admin-tournament-btn-close-${tournament.id}`}
              name={`closeTournament-${tournament.id}`}
              variant="destructive"
              size="icon-sm"
              type="button"
              title={finished ? 'Regenerar snapshot de cierre' : 'Cerrar torneo'}
              aria-label={finished ? 'Regenerar snapshot de cierre' : 'Cerrar torneo'}
              className="shrink-0"
            >
              <Lock className="size-3.5" />
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div
      role="toolbar"
      id={`admin-tournament-toolbar-mobile-${tournament.id}`}
      data-name={`tournament-toolbar-mobile-${tournament.id}`}
      aria-label={`Acciones del torneo ${tournament.name}`}
      className="flex flex-col gap-2"
    >
      <RenameTournamentModal tournament={tournament} saving={renameSaving} onSave={onRenameSave} density="comfortable" />
      <Link
        id={`admin-tournament-mobile-link-groups-${tournament.id}`}
        data-name={`mobile-groups-${tournament.id}`}
        className={buttonVariants({
          variant: 'outline',
          size: 'sm',
          className: 'inline-flex h-9 w-full justify-center gap-2',
        })}
        to={`/admin/groups?tournament=${tournament.id}`}
      >
        <Grid3x3 className="size-3.5 shrink-0" />
        Grupos y cruces
      </Link>
      <Link
        id={`admin-tournament-mobile-link-dashboard-${tournament.id}`}
        data-name={`viewDashboardMobile-${tournament.id}`}
        className={buttonVariants({
          variant: 'ghost',
          size: 'sm',
          className: 'inline-flex h-9 w-full justify-center gap-2 text-slate-700',
        })}
        to={`/dashboard?tournament=${encodeURIComponent(tournament.id)}`}
      >
        <Eye className="size-3.5 shrink-0" />
        Abrir torneo
      </Link>
      {canActivate ? (
        <Button
          id={`admin-tournament-mobile-btn-activate-${tournament.id}`}
          name={`activateTournamentMobile-${tournament.id}`}
          variant="outline"
          size="sm"
          type="button"
          className="h-9 w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          disabled={activateSaving}
          onClick={() => void onActivate()}
        >
          <CheckCircle2 className="size-3.5 shrink-0" />
          Activar torneo
        </Button>
      ) : null}
      <CloseTournamentDialog
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        closedBy={closedBy}
        trigger={
          <Button
            id={`admin-tournament-mobile-btn-close-${tournament.id}`}
            name={`closeTournamentMobile-${tournament.id}`}
            variant="destructive"
            size="sm"
            type="button"
            className="h-9 w-full gap-2"
          >
            <Lock className="size-3.5 shrink-0" />
            {finished ? 'Regenerar cierre' : 'Cerrar torneo'}
          </Button>
        }
      />
    </div>
  )
}

export function AdminTournamentsPage() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const tournamentsQ = useQuery({ queryKey: ['admin-tournaments'], queryFn: listTournaments })
  const overviewQ = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => getAdminOverviewData(),
  })

  /** Torneo «abierto»: borrador o activo (no cuenta finalizados ni archivados). */
  const blockingTournament = useMemo(() => {
    const open = (tournamentsQ.data ?? []).filter((t) => t.status === 'draft' || t.status === 'active')
    const active = open.find((t) => t.status === 'active')
    return active ?? open[0] ?? null
  }, [tournamentsQ.data])

  const activeTournament = useMemo(
    () => (tournamentsQ.data ?? []).find((t) => t.status === 'active') ?? null,
    [tournamentsQ.data],
  )

  const hasOpenTournament = Boolean(blockingTournament)

  useEffect(() => {
    clearAdminNextTournamentRouteAccess()
  }, [])

  const renameMut = useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      await updateTournament(input.id, { name: input.name })
    },
    onSuccess: async (_, { id }) => {
      toast.success('Torneo renombrado')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
        qc.invalidateQueries({ queryKey: ['tournaments'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
        qc.invalidateQueries({ queryKey: ['tournament', id] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard-options'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al renombrar'),
  })

  const activateMut = useMutation({
    mutationFn: async (tournament: Tournament) => {
      const otherActive = (tournamentsQ.data ?? []).find(
        (t) => t.id !== tournament.id && t.status === 'active',
      )
      if (otherActive) {
        throw new Error(`Antes de activar este torneo, cierra ${otherActive.name}.`)
      }
      const otherDraft = (tournamentsQ.data ?? []).find(
        (t) => t.id !== tournament.id && t.status === 'draft',
      )
      if (otherDraft) {
        throw new Error(`Antes de activar este torneo, cierra o activa ${otherDraft.name}.`)
      }
      await updateTournament(tournament.id, {
        status: 'active',
        ...(tournament.status === 'finished' ? { finished_at: null, closed_by: null } : {}),
      })
    },
    onSuccess: async (_, tournament) => {
      toast.success('Torneo activado')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
        qc.invalidateQueries({ queryKey: ['tournaments'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
        qc.invalidateQueries({ queryKey: ['tournament', tournament.id] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard-options'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al activar torneo'),
  })

  const tournaments = useMemo(
    () => sortTournamentsByCreatedDesc(tournamentsQ.data ?? []),
    [tournamentsQ.data],
  )

  const columns: AdminDataTableColumn<Tournament>[] = [
    {
      key: 'name',
      header: 'Torneo',
      render: (tournament) => (
        <div
          id={`admin-tournament-cell-name-${tournament.id}`}
          data-name="tournament-name-cell"
          className="flex min-w-0 items-center gap-2.5 py-0.5"
        >
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              tournament.status === 'active'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600',
            )}
            aria-hidden
          >
            <Trophy className="size-3.5" />
          </span>
          <p className="min-w-0 truncate font-medium text-[#102A43]">{tournament.name}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      className: 'w-[7.5rem]',
      render: (tournament) => (
        <div id={`admin-tournament-cell-status-${tournament.id}`} data-name="tournament-status-cell">
          <AdminStatusBadge status={tournament.status} />
        </div>
      ),
    },
    {
      key: 'created',
      header: 'Creado',
      className: 'w-[8.5rem] whitespace-nowrap text-sm tabular-nums text-slate-600',
      render: (tournament) => (
        <span id={`admin-tournament-cell-created-${tournament.id}`} data-name="tournament-created-cell">
          {formatTournamentCreatedAt(tournament.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'align-middle whitespace-nowrap',
      render: (tournament) => (
        <div id={`admin-tournament-cell-actions-${tournament.id}`} data-name="tournament-actions-cell">
          <TournamentActionsToolbar
            tournament={tournament}
            renameSaving={renameMut.isPending}
            activateSaving={activateMut.isPending}
            onRenameSave={(name) => renameMut.mutateAsync({ id: tournament.id, name })}
            onActivate={() => activateMut.mutateAsync(tournament)}
            closedBy={userId}
            layout="table"
          />
        </div>
      ),
    },
  ]

  const overview = overviewQ.data

  return (
    <div id="page-admin-tournaments" className="space-y-5 sm:space-y-8 md:space-y-10">
      <section
        id="section-admin-tournaments-header"
        data-name="admin-tournaments-page-header"
        className="space-y-4 sm:space-y-5"
      >
        <AdminPageHeader
          eyebrow="Administración"
          title="Torneos"
          description="Gestiona torneos y revisa el estado operativo (grupos, cruces y resultados)."
          actions={
            <div
              id="admin-tournaments-header-actions"
              className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end"
            >
              <div
                id="admin-tournaments-actions-create-row"
                data-name="tournaments-primary-actions"
                className="flex w-full flex-col gap-2 sm:w-auto sm:justify-end"
              >
                <NextTournamentHeaderAction disabled={hasOpenTournament} />
              </div>
            </div>
          }
        />
        {hasOpenTournament && blockingTournament ? (
          <div
            id="admin-tournaments-banner-open-tournament"
            data-name="blocking-open-tournament-banner"
            className={cn(
              'w-full rounded-2xl border p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5',
              blockingTournament.status === 'draft'
                ? 'border-emerald-200/75 bg-gradient-to-br from-emerald-50/90 via-white to-slate-50/35'
                : 'border-amber-200/75 bg-gradient-to-br from-amber-50/90 via-white to-slate-50/35',
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <div
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
                  blockingTournament.status === 'draft'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900',
                )}
              >
                {blockingTournament.status === 'draft' ? (
                  <CheckCircle2 className="size-[18px]" aria-hidden />
                ) : (
                  <Lock className="size-[18px]" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-base font-semibold leading-snug tracking-tight text-[#102A43]">
                    {blockingTournament.status === 'draft'
                      ? 'Torneo en borrador listo para activar'
                      : 'Un torneo sigue abierto'}
                  </p>
                  <AdminStatusBadge status={blockingTournament.status} />
                </div>
                <p className="text-pretty text-sm leading-relaxed text-slate-600">
                  {blockingTournament.status === 'draft' ? (
                    <>
                      <span className="font-medium text-slate-800">{blockingTournament.name}</span> está preparado.
                      Actívalo para habilitar dashboard, captura de marcadores y operación diaria.
                    </>
                  ) : (
                    <>
                      Solo puede haber un borrador o torneo activo a la vez. Finaliza{' '}
                      <span className="font-medium text-slate-800">{blockingTournament.name}</span> para crear uno
                      nuevo o usar «Siguiente torneo».
                    </>
                  )}
                </p>
                <div className="flex flex-col gap-2 border-t border-slate-200/50 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2 sm:border-t-0 sm:pt-2">
                  {blockingTournament.status === 'draft' ? (
                    <Button
                      id="admin-tournaments-banner-btn-activate"
                      name="activateBlockingTournament"
                      type="button"
                      variant="default"
                      className="h-10 w-full bg-emerald-700 hover:bg-emerald-800 sm:w-auto"
                      disabled={activateMut.isPending}
                      onClick={() => void activateMut.mutateAsync(blockingTournament)}
                    >
                      <CheckCircle2 className="size-4" />
                      {activateMut.isPending ? 'Activando…' : 'Activar torneo'}
                    </Button>
                  ) : null}
                  <p className="text-xs leading-snug text-slate-600 sm:max-w-md sm:text-right">
                    <span
                      className={cn(
                        'mr-1 inline font-medium',
                        blockingTournament.status === 'draft' ? 'text-emerald-800/90' : 'text-amber-800/90',
                      )}
                      aria-hidden
                    >
                      →
                    </span>
                    {blockingTournament.status === 'draft'
                      ? 'También puedes activarlo desde la tabla inferior con el botón verde.'
                      : 'Cierra el torneo desde la tabla inferior con el botón del candado.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {overviewQ.isLoading ? (
        <div id="admin-tournaments-loading" className="space-y-5 sm:space-y-8">
          <Skeleton className="h-8 max-w-sm rounded-lg" />
          <div className={ADMIN_METRIC_GRID_4}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[5.5rem] rounded-2xl sm:h-24" />
            ))}
          </div>
        </div>
      ) : overview ? (
        <>
          <section id="section-admin-tournaments-metrics-op" className="space-y-3 sm:space-y-4" aria-labelledby="tournaments-metrics-op">
            <AdminSectionTitle
              id="tournaments-metrics-op"
              title="Operacion general"
              description="Lectura rapida del torneo activo y su avance operativo."
            />
            <div id="admin-tournaments-metrics-operation" className={ADMIN_METRIC_GRID_4}>
              <AdminMetricCard
                id="admin-tournaments-metric-active-tournaments"
                label="Torneo activo"
                value={activeTournament?.name ?? 'Sin torneo activo'}
                tone="success"
                description="Torneo actualmente en operacion"
              />
              <AdminMetricCard
                id="admin-tournaments-metric-total-players"
                label="Jugadores"
                value={overview.totalPlayers}
                tone="neutral"
                description="Inscritos dentro del alcance activo"
              />
              <AdminMetricCard
                id="admin-tournaments-metric-matches-progress"
                label="Partidos por jugar"
                value={`${overview.matchesWithoutDate}/${overview.totalMatches}`}
                tone={overview.matchesWithoutDate > 0 ? 'warning' : 'success'}
                description="Pendientes de marcador vs partidos totales"
              />
              <AdminMetricCard
                id="admin-tournaments-metric-total-groups"
                label="Grupos"
                value={overview.totalGroups}
                tone="info"
                description="Grupos creados en el torneo activo"
              />
            </div>
          </section>
        </>
      ) : null}

      <section id="section-admin-tournaments-list" className="space-y-4" aria-labelledby="tournaments-table-heading">
        <AdminSectionTitle
          id="tournaments-table-heading"
          title="Torneos registrados"
          description={
            hasOpenTournament
              ? 'Más recientes primero. Administra el ciclo del torneo abierto: preparar, activar, operar y cerrar.'
              : 'Más recientes primero. El historial queda cerrado; puedes activar un borrador o iniciar el siguiente torneo.'
          }
        />
        <div
          id="admin-tournaments-lifecycle-story"
          className="grid gap-2 rounded-xl border border-slate-200/60 bg-slate-50/50 p-2 sm:grid-cols-3 sm:gap-3 sm:p-3"
        >
          <div className="flex items-center gap-2.5 rounded-lg bg-white/80 px-3 py-2.5 ring-1 ring-slate-200/60">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-800">
              <Pencil className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900">Preparar</p>
              <p className="truncate text-[11px] text-slate-500">Borrador, grupos y reglas</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-white/80 px-3 py-2.5 ring-1 ring-emerald-200/50">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900">Activar</p>
              <p className="truncate text-[11px] text-slate-500">Operación y dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-white/80 px-3 py-2.5 ring-1 ring-amber-200/50">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-900">
              <Lock className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900">Cerrar</p>
              <p className="truncate text-[11px] text-slate-500">Ranking final y snapshot</p>
            </div>
          </div>
        </div>
        {tournamentsQ.isLoading ? (
          <Skeleton className="h-72 rounded-2xl" />
        ) : tournaments.length === 0 ? (
          <div id="admin-tournaments-empty-state" data-name="tournaments-empty">
            <AdminEmptyState
              title="Aún no hay torneos creados."
              description="Crea el primer torneo para comenzar a organizar grupos y partidos."
              icon={Trophy}
            />
          </div>
        ) : (
          <>
            <div id="admin-tournaments-table-desktop" className="hidden md:block">
              <AdminDataTable
                tableId="admin-tournaments-data-table"
                rows={tournaments}
                columns={columns}
                getRowKey={(tournament) => tournament.id}
                getRowDomId={(tournament) => `admin-tournament-row-${tournament.id}`}
                getRowClassName={(tournament) =>
                  tournament.status === 'active'
                    ? 'bg-emerald-50/40 hover:bg-emerald-50/60'
                    : undefined
                }
              />
            </div>
            <div id="admin-tournaments-cards-mobile" className="grid grid-cols-1 gap-3 md:hidden">
              {tournaments.map((tournament) => (
                <Card
                  key={tournament.id}
                  id={`admin-tournament-card-${tournament.id}`}
                  className={cn(
                    'rounded-2xl border border-slate-200/70 bg-white shadow-sm',
                    tournament.status === 'active' && 'border-emerald-200/80 ring-1 ring-emerald-100',
                  )}
                >
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <span
                          className={cn(
                            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                            tournament.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600',
                          )}
                          aria-hidden
                        >
                          <Trophy className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug text-[#102A43]">{tournament.name}</p>
                          <p className="mt-1 text-xs tabular-nums text-[#64748B]">
                            Creado {formatTournamentCreatedAt(tournament.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <AdminStatusBadge status={tournament.status} />
                      </div>
                    </div>
                    <div className="border-t border-[#E2E8F0] pt-3">
                      <TournamentActionsToolbar
                        tournament={tournament}
                        renameSaving={renameMut.isPending}
                        activateSaving={activateMut.isPending}
                        onRenameSave={(name) => renameMut.mutateAsync({ id: tournament.id, name })}
                        onActivate={() => activateMut.mutateAsync(tournament)}
                        closedBy={userId}
                        layout="card"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
