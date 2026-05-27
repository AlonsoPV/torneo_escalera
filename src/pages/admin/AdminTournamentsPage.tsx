import { ArrowRightLeft, CheckCircle2, Eye, Grid3x3, Lock, Pencil, Trophy } from 'lucide-react'
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
import type { Tournament } from '@/types/database'

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
  const canActivate = tournament.status === 'draft'

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
          disabled={finished}
          trigger={
            <Button
              id={`admin-tournament-btn-close-${tournament.id}`}
              name={`closeTournament-${tournament.id}`}
              variant="destructive"
              size="icon-sm"
              type="button"
              disabled={finished}
              title="Cerrar torneo"
              aria-label="Cerrar torneo"
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
        disabled={finished}
        trigger={
          <Button
            id={`admin-tournament-mobile-btn-close-${tournament.id}`}
            name={`closeTournamentMobile-${tournament.id}`}
            variant="destructive"
            size="sm"
            type="button"
            className="h-9 w-full gap-2"
            disabled={finished}
          >
            <Lock className="size-3.5 shrink-0" />
            Cerrar torneo
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
      const otherOpen = (tournamentsQ.data ?? []).find(
        (t) => t.id !== tournament.id && (t.status === 'draft' || t.status === 'active'),
      )
      if (otherOpen) {
        throw new Error(`Antes de activar este torneo, cierra ${otherOpen.name}.`)
      }
      await updateTournament(tournament.id, { status: 'active' })
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

  const columns: AdminDataTableColumn<Tournament>[] = [
    {
      key: 'name',
      header: 'Torneo',
      render: (tournament) => (
        <div id={`admin-tournament-cell-name-${tournament.id}`} data-name="tournament-name-cell">
          <p className="font-medium text-[#102A43]">{tournament.name}</p>
          <p className="text-xs text-[#64748B]">{tournament.category ?? 'Sin categoría'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (tournament) => (
        <div id={`admin-tournament-cell-status-${tournament.id}`} data-name="tournament-status-cell">
          <AdminStatusBadge status={tournament.status} />
        </div>
      ),
    },
    {
      key: 'created',
      header: 'Creado',
      render: (tournament) => (
        <span id={`admin-tournament-cell-created-${tournament.id}`} data-name="tournament-created-cell">
          {tournament.created_at.slice(0, 10)}
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
                className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end"
              >
                {hasOpenTournament ? (
                  <span
                    id="admin-tournaments-next-wizard-disabled"
                    data-name="next-tournament-wizard-disabled"
                    className={cn(
                      buttonVariants({ variant: 'outline', className: 'w-full justify-center sm:w-auto' }),
                      'pointer-events-none cursor-not-allowed border-dashed border-slate-200 bg-slate-50/80 text-slate-500 opacity-80',
                    )}
                    title="Finaliza el torneo abierto antes de crear el siguiente"
                  >
                    <ArrowRightLeft className="size-4 opacity-70" />
                    Crear siguiente torneo
                  </span>
                ) : (
                  <Link
                    id="admin-tournaments-link-next-wizard"
                    data-name="link-next-tournament-wizard"
                    to="/admin/next-tournament"
                    className={buttonVariants({ variant: 'outline', className: 'w-full justify-center sm:w-auto' })}
                    onClick={() => grantAdminNextTournamentRouteAccess()}
                  >
                    <ArrowRightLeft className="size-4" />
                    Crear siguiente torneo
                  </Link>
                )}
              </div>
            </div>
          }
        />
        {hasOpenTournament && blockingTournament ? (
          <div
            id="admin-tournaments-banner-open-tournament"
            data-name="blocking-open-tournament-banner"
            className={cn(
              'w-full rounded-2xl border border-amber-200/75 bg-gradient-to-br from-amber-50/90 via-white to-slate-50/35',
              'p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5',
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                <Lock className="size-[18px]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-base font-semibold leading-snug tracking-tight text-[#102A43]">
                    Un torneo sigue abierto
                  </p>
                  <AdminStatusBadge status={blockingTournament.status} />
                </div>
                <p className="text-pretty text-sm leading-relaxed text-slate-600">
                  Solo puede haber un borrador o torneo activo a la vez. Finaliza{' '}
                  <span className="font-medium text-slate-800">{blockingTournament.name}</span> para crear uno nuevo o
                  usar «Siguiente torneo».
                </p>
                <div className="flex flex-col gap-2 border-t border-amber-200/40 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2 sm:border-t-0 sm:pt-2">
                  
                  <p className="text-xs leading-snug text-slate-600 sm:max-w-md sm:text-right">
                    <span className="mr-1 inline font-medium text-amber-800/90" aria-hidden>
                      →
                    </span>
                    Cierra el torneo desde la tabla inferior con el botón del candado.
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
              ? 'Administra el ciclo del torneo abierto: preparar, activar, operar y cerrar con reglas claras.'
              : 'El historial queda cerrado; puedes activar un borrador o iniciar el siguiente torneo.'
          }
        />
        <div
          id="admin-tournaments-lifecycle-story"
          className="grid gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm sm:grid-cols-3 sm:p-4"
        >
          <div className="flex gap-3 rounded-xl bg-slate-50/80 p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
              <Pencil className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Preparar</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-600">Borrador, grupos, reglas y cruces listos.</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl bg-emerald-50/70 p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Activar</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-600">El torneo entra en operacion y se abre en dashboard.</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl bg-amber-50/70 p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
              <Lock className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Cerrar</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-600">Guarda ranking final; si falta marcador, aplica regla de cierre.</p>
            </div>
          </div>
        </div>
      {tournamentsQ.isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : (tournamentsQ.data ?? []).length === 0 ? (
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
              rows={tournamentsQ.data ?? []}
              columns={columns}
              getRowKey={(tournament) => tournament.id}
              getRowDomId={(tournament) => `admin-tournament-row-${tournament.id}`}
            />
          </div>
          <div id="admin-tournaments-cards-mobile" className="grid grid-cols-1 gap-4 md:hidden">
            {(tournamentsQ.data ?? []).map((tournament) => (
              <Card
                key={tournament.id}
                id={`admin-tournament-card-${tournament.id}`}
                className="rounded-2xl border border-slate-200/70 bg-white shadow-sm"
              >
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#102A43]">{tournament.name}</p>
                      <p className="mt-0.5 text-xs text-[#64748B]">{tournament.category ?? 'Sin categoría'}</p>
                    </div>
                    <div className="shrink-0">
                      <AdminStatusBadge status={tournament.status} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-[#64748B]">Creado</p>
                      <p className="font-medium text-[#102A43]">{tournament.created_at.slice(0, 10)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">Flujo</p>
                      <p className="font-medium text-[#102A43]">
                        {tournament.status === 'active'
                          ? 'En juego'
                          : tournament.status === 'draft'
                            ? 'Preparacion'
                            : tournament.status === 'finished'
                              ? 'Cerrado'
                              : 'Archivado'}
                      </p>
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
