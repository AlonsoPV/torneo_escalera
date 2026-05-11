import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Eye,
  Flag,
  Lock,
  Pencil,
  Plus,
  Trophy,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/shared/AdminDataTable'
import { AdminConfirmDialog } from '@/components/admin/shared/AdminConfirmDialog'
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
import { cn } from '@/lib/utils'
import { tournamentPath } from '@/lib/tournamentUrl'
import { computeAdminMatchBreakdown, getAdminMatches, getAdminOverviewData } from '@/services/admin'
import { createTournament, listTournaments, updateTournament } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { Tournament } from '@/types/database'

function CreateTournamentModal({
  onCreate,
  disabled,
}: {
  onCreate: (values: { name: string; category: string }) => void
  disabled?: boolean
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')

  return (
    <AdminFormModal
      trigger={
        <Button
          id="admin-tournaments-btn-open-create"
          name="open-create-tournament"
          className="w-full sm:w-auto"
          disabled={disabled}
          title={disabled ? 'Cierra el torneo actual antes de crear otro' : undefined}
        >
          <Plus className="size-4" />
          Crear torneo
        </Button>
      }
      title="Crear torneo"
      description={
        disabled
          ? 'Cierra el torneo actual (estado finalizado) antes de crear uno nuevo.'
          : 'Se crea en borrador con reglas por defecto para configurarlo después.'
      }
    >
      <form
        id="form-admin-tournament-create"
        name="createTournament"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onCreate({ name, category })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="admin-tournament-create-name">Nombre</Label>
          <Input
            id="admin-tournament-create-name"
            name="tournamentName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-tournament-create-category">Categoría</Label>
          <Input
            id="admin-tournament-create-category"
            name="tournamentCategory"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            autoComplete="off"
          />
        </div>
        <Button id="admin-tournament-create-submit" name="submitCreateTournament" type="submit" className="w-full" disabled={disabled}>
          Crear torneo
        </Button>
      </form>
    </AdminFormModal>
  )
}

function RenameTournamentModal({
  tournament,
  onSave,
  saving,
}: {
  tournament: Tournament
  onSave: (name: string) => Promise<void>
  saving: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(tournament.name)

  useEffect(() => {
    if (open) setName(tournament.name)
  }, [open, tournament.id, tournament.name])

  return (
    <AdminFormModal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          id={`admin-tournament-btn-rename-${tournament.id}`}
          variant="outline"
          size="sm"
          type="button"
          disabled={saving}
        >
          <Pencil className="size-3.5" />
          Renombrar
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
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar nombre'}
        </Button>
      </form>
    </AdminFormModal>
  )
}

export function AdminTournamentsPage() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const [pendingMetricsOpen, setPendingMetricsOpen] = useState(false)
  const tournamentsQ = useQuery({ queryKey: ['admin-tournaments'], queryFn: listTournaments })
  const overviewQ = useQuery({ queryKey: ['admin-overview'], queryFn: getAdminOverviewData })
  const matchesQ = useQuery({ queryKey: ['admin-matches'], queryFn: () => getAdminMatches() })
  const breakdown = useMemo(() => computeAdminMatchBreakdown(matchesQ.data ?? []), [matchesQ.data])

  const hasOpenTournament = useMemo(
    () => (tournamentsQ.data ?? []).some((t) => t.status !== 'finished'),
    [tournamentsQ.data],
  )

  const createMut = useMutation({
    mutationFn: async (values: { name: string; category: string }) => {
      if (!userId) throw new Error('No autenticado')
      return createTournament({
        name: values.name,
        category: values.category,
        status: 'draft',
        createdBy: userId,
      })
    },
    onSuccess: async () => {
      toast.success('Torneo creado')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al crear torneo'),
  })

  const closeMut = useMutation({
    mutationFn: async (tournamentId: string) => {
      await updateTournament(tournamentId, { status: 'finished' })
    },
    onSuccess: async () => {
      toast.success('Torneo cerrado')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
        qc.invalidateQueries({ queryKey: ['tournaments'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
      ])
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al cerrar torneo'),
  })

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

  const columns: AdminDataTableColumn<Tournament>[] = [
    {
      key: 'name',
      header: 'Torneo',
      render: (tournament) => (
        <div>
          <p className="font-medium text-[#102A43]">{tournament.name}</p>
          <p className="text-xs text-[#64748B]">{tournament.category ?? 'Sin categoría'}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Estado', render: (tournament) => <AdminStatusBadge status={tournament.status} /> },
    { key: 'season', header: 'Temporada', render: (tournament) => tournament.season ?? '-' },
    { key: 'created', header: 'Creado', render: (tournament) => tournament.created_at.slice(0, 10) },
    {
      key: 'actions',
      header: 'Acciones',
      render: (tournament) => (
        <div className="flex flex-wrap gap-2">
          <RenameTournamentModal
            tournament={tournament}
            saving={renameMut.isPending}
            onSave={(name) => renameMut.mutateAsync({ id: tournament.id, name })}
          />
          <Link
            id={`admin-tournament-link-manage-${tournament.id}`}
            data-name={`manageTournament-${tournament.id}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            to={tournamentPath(tournament)}
          >
            Gestionar torneo
          </Link>
          <Link
            id={`admin-tournament-link-dashboard-${tournament.id}`}
            data-name={`viewDashboard-${tournament.id}`}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            to="/dashboard"
          >
            <Eye className="size-3.5" />
            Ver en inicio
          </Link>
          <AdminConfirmDialog
            title="¿Cerrar torneo?"
            description="El torneo pasará a estado finalizado. Los resultados seguirán visibles para consulta."
            confirmLabel="Cerrar torneo"
            disabled={closeMut.isPending || tournament.status === 'finished'}
            onConfirm={() => closeMut.mutate(tournament.id)}
            trigger={
              <Button
                id={`admin-tournament-btn-close-${tournament.id}`}
                name={`closeTournament-${tournament.id}`}
                variant="destructive"
                size="sm"
                disabled={tournament.status === 'finished'}
              >
                <Lock className="size-3.5" />
                Cerrar torneo
              </Button>
            }
          />
        </div>
      ),
    },
  ]

  const overview = overviewQ.data

  return (
    <div id="page-admin-tournaments" className="space-y-5 sm:space-y-8 md:space-y-10">
      <AdminPageHeader
        eyebrow="Administración"
        title="Torneos"
        description="Gestiona torneos, revisa el estado operativo (grupos, cruces y resultados) y abre el detalle para reglas."
        actions={<CreateTournamentModal disabled={hasOpenTournament} onCreate={(values) => createMut.mutate(values)} />}
      />

      {overviewQ.isLoading || matchesQ.isLoading ? (
        <div id="admin-tournaments-loading" className="space-y-5 sm:space-y-8">
          <Skeleton className="h-8 max-w-sm rounded-lg" />
          <div className={ADMIN_METRIC_GRID_4}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[5.5rem] rounded-2xl sm:h-24" />
            ))}
          </div>
        </div>
      ) : overview ? (
        <>
          <section id="section-admin-tournaments-metrics-op" className="space-y-3 sm:space-y-4" aria-labelledby="tournaments-metrics-op">
            <AdminSectionTitle
              id="tournaments-metrics-op"
              title="Operación general"
              description="Capacidad actual del sistema y torneos en curso."
            />
            <div id="admin-tournaments-metrics-operation" className={ADMIN_METRIC_GRID_4}>
              <AdminMetricCard
                label="Torneos activos"
                value={overview.activeTournaments}
                icon={Trophy}
                tone="success"
                description={`De ${overview.totalTournaments} torneo(s) en total`}
              />
              <AdminMetricCard
                label="Total jugadores"
                value={overview.totalPlayers}
                icon={Users}
                tone="neutral"
                description="Rol jugador en perfiles"
              />
              <AdminMetricCard
                label="Total grupos"
                value={overview.totalGroups}
                icon={Flag}
                tone="info"
                description="Grupos creados"
              />
              <AdminMetricCard
                label="Grupos incompletos"
                value={overview.incompleteGroups}
                icon={AlertTriangle}
                tone={overview.incompleteGroups > 0 ? 'warning' : 'neutral'}
                description="Por debajo del cupo del grupo"
              />
            </div>
          </section>

          <section
            id="section-admin-tournaments-metrics-pending"
            className="rounded-xl border border-amber-200/70 bg-gradient-to-b from-amber-50/35 to-white p-3 shadow-sm ring-1 ring-amber-900/[0.04] sm:rounded-2xl sm:p-4 sm:ring-amber-900/[0.03]"
            aria-label="Marcadores y pendientes"
          >
            <details onToggle={(event) => setPendingMetricsOpen(event.currentTarget.open)}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-lg py-0.5 text-left outline-none [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white">
                <div className="min-w-0 flex-1 pr-1">
                  <h3 id="tournaments-metrics-pending" className="text-sm font-semibold leading-snug tracking-tight text-slate-900 sm:text-[0.9375rem]">
                    Marcadores y pendientes
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500 sm:text-xs">
                    <span className="max-sm:inline sm:hidden">Toca para ver marcadores pendientes y revisiones.</span>
                    <span className="hidden sm:inline">Cruces pendientes y cola de revisión de marcadores.</span>
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'mt-0.5 size-5 shrink-0 text-amber-800/70 transition-transform duration-200',
                    pendingMetricsOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </summary>

              <div className="mt-3 border-t border-amber-200/60 pt-3 sm:mt-3 sm:pt-3">
                <p className="mb-3 hidden text-xs leading-relaxed text-slate-500 sm:block">
                  Cruces pendientes y cola de revisión de marcadores.
                </p>
                <div
                  id="admin-tournaments-metrics-pending"
                  className={cn('max-sm:flex max-sm:flex-col max-sm:gap-2', 'sm:grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-5')}
                >
                  <AdminMetricCard
                    label="Pendientes de marcador"
                    value={breakdown.pendingScore}
                    icon={CalendarDays}
                    tone="info"
                    description="Disponibles para captura"
                  />
                  <AdminMetricCard
                    label="Cruces sin marcador"
                    value={overview.matchesWithoutDate}
                    icon={CalendarClock}
                    tone={overview.matchesWithoutDate > 0 ? 'warning' : 'neutral'}
                    description="Aún sin captura"
                  />
                  <AdminMetricCard
                    label="Resultados pendientes"
                    value={overview.pendingResults}
                    icon={AlertTriangle}
                    tone={overview.pendingResults > 0 ? 'warning' : 'neutral'}
                    description="Marcador enviado por jugador"
                  />
                  <AdminMetricCard
                    label="Resultados confirmados"
                    value={overview.confirmedResults}
                    icon={CheckCircle2}
                    tone="success"
                    description="Cerrados por administración"
                  />
                </div>
              </div>
            </details>
          </section>
        </>
      ) : null}

      <section id="section-admin-tournaments-list" className="space-y-4" aria-labelledby="tournaments-table-heading">
        <AdminSectionTitle
          id="tournaments-table-heading"
          title="Torneos registrados"
          description="Cerrar un torneo liberará la creación de uno nuevo."
        />
      {tournamentsQ.isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : (tournamentsQ.data ?? []).length === 0 ? (
        <AdminEmptyState
          title="Aún no hay torneos creados."
          description="Crea el primer torneo para comenzar a organizar grupos y partidos."
          icon={Trophy}
        />
      ) : (
        <>
          <div id="admin-tournaments-table-desktop" className="hidden md:block">
            <AdminDataTable rows={tournamentsQ.data ?? []} columns={columns} getRowKey={(tournament) => tournament.id} />
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
                      <p className="text-xs text-[#64748B]">Temporada</p>
                      <p className="font-medium text-[#102A43]">{tournament.season ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">Creado</p>
                      <p className="font-medium text-[#102A43]">{tournament.created_at.slice(0, 10)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 border-t border-[#E2E8F0] pt-3 sm:flex-row sm:flex-wrap">
                    <RenameTournamentModal
                      tournament={tournament}
                      saving={renameMut.isPending}
                      onSave={(name) => renameMut.mutateAsync({ id: tournament.id, name })}
                    />
                    <Link
                      id={`admin-tournament-mobile-link-manage-${tournament.id}`}
                      data-name={`manageTournamentMobile-${tournament.id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full justify-center sm:w-auto' })}
                      to={tournamentPath(tournament)}
                    >
                      Gestionar torneo
                    </Link>
                    <Link
                      id={`admin-tournament-mobile-link-dashboard-${tournament.id}`}
                      data-name={`viewDashboardMobile-${tournament.id}`}
                      className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'w-full justify-center sm:w-auto' })}
                      to="/dashboard"
                    >
                      <Eye className="size-3.5" />
                      Ver en inicio
                    </Link>
                    <AdminConfirmDialog
                      title="¿Cerrar torneo?"
                      description="El torneo pasará a estado finalizado. Los resultados seguirán visibles para consulta."
                      confirmLabel="Cerrar torneo"
                      disabled={closeMut.isPending || tournament.status === 'finished'}
                      onConfirm={() => closeMut.mutate(tournament.id)}
                      trigger={
                        <Button
                          id={`admin-tournament-mobile-btn-close-${tournament.id}`}
                          name={`closeTournamentMobile-${tournament.id}`}
                          variant="destructive"
                          size="sm"
                          className="w-full sm:w-auto"
                          disabled={tournament.status === 'finished'}
                        >
                          <Lock className="size-3.5" />
                          Cerrar torneo
                        </Button>
                      }
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
