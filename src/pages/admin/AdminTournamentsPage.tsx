import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Eye,
  Flag,
  FlaskConical,
  Grid3x3,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { isDummyResultsSeedEnabled } from '@/lib/dummyResultsSeedEnv'
import { isAdminRole } from '@/lib/permissions'
import { computeAdminMatchBreakdown, getAdminMatches, getAdminOverviewData } from '@/services/admin'
import { seedDummyResultsForTournament } from '@/services/dummyResultsSeed'
import { createTournament, listTournaments, updateTournament } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { Tournament } from '@/types/database'

function CreateTournamentModal({
  onCreate,
  disabled,
}: {
  onCreate: (values: {
    name: string
    category: string
    initialGroups: 'none' | 'per_category'
  }) => void
  disabled?: boolean
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [initialGroups, setInitialGroups] = useState<'none' | 'per_category'>('none')

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
          onCreate({ name, category, initialGroups })
          setName('')
          setCategory('')
          setInitialGroups('none')
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
        <div className="space-y-2">
          <Label htmlFor="admin-tournament-create-groups">Grupos iniciales</Label>
          <Select
            value={initialGroups}
            onValueChange={(v) => setInitialGroups(v as 'none' | 'per_category')}
          >
            <SelectTrigger id="admin-tournament-create-groups" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                Sin grupos (crear después en Grupos)
              </SelectItem>
              <SelectItem value="per_category">
                Un grupo vacío por cada división (registros en la tabla groups)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            Las divisiones por defecto (Primera, Ascenso, Fuerzas básicas) se crean al guardar el torneo.
          </p>
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
  density = 'comfortable',
}: {
  tournament: Tournament
  onSave: (name: string) => Promise<void>
  saving: boolean
  density?: 'comfortable' | 'compact'
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(tournament.name)

  useEffect(() => {
    if (open) setName(tournament.name)
  }, [open, tournament.id, tournament.name])

  const compact = density === 'compact'

  return (
    <AdminFormModal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          id={`admin-tournament-btn-rename-${tournament.id}`}
          variant="outline"
          size={compact ? 'icon-sm' : 'sm'}
          type="button"
          disabled={saving}
          title="Renombrar torneo"
          aria-label="Renombrar torneo"
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
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar nombre'}
        </Button>
      </form>
    </AdminFormModal>
  )
}

function AdminSeedDummyResultsButton({
  tournamentId,
  triggerClassName,
  variant = 'full',
}: {
  tournamentId: string
  triggerClassName?: string
  variant?: 'full' | 'icon'
}) {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  const userId = useAuthStore((s) => s.user?.id)

  const seedMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('No autenticado.')
      const role = profile?.role
      if (!isAdminRole(role)) throw new Error('Solo el staff (admin) puede usar esta acción.')
      return seedDummyResultsForTournament({
        tournamentId,
        actorUserId: userId,
        actorRole: role,
      })
    },
    onSuccess: async (res) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard-options'] }),
        qc.invalidateQueries({ queryKey: ['tournament', tournamentId] }),
      ])
      toast.success(
        `Dummy listo: ${res.groupsProcessed} grupo(s) procesados, ${res.resultsGenerated} marcador(es), ${res.matchesGenerated} cruce(s) nuevos, ${res.groupsSkipped} grupo(s) omitidos.`,
      )
      if (res.errors.length > 0) {
        toast.warning('Detalle de omisiones o errores', {
          description: res.errors.slice(0, 12).join('\n'),
        })
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al generar dummy'),
  })

  if (!isDummyResultsSeedEnabled() || !isAdminRole(profile?.role)) return null

  return (
    <AdminConfirmDialog
      title="¿Generar resultados dummy?"
      description="Esta acción generará resultados ficticios para probar rankings y generación del siguiente torneo. No sobrescribe partidos cerrados ni marcadores ya guardados."
      confirmLabel="Generar dummy"
      disabled={seedMut.isPending}
      onConfirm={() => seedMut.mutate()}
      trigger={
        <Button
          variant="outline"
          size={variant === 'icon' ? 'icon-sm' : 'sm'}
          type="button"
          disabled={seedMut.isPending || !userId}
          title="Generar resultados ficticios (solo pruebas)"
          aria-label="Generar resultados dummy para pruebas"
          className={cn(
            'border-dashed border-amber-400/80 text-amber-950 hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-100 dark:hover:bg-amber-950/40',
            triggerClassName,
          )}
        >
          <FlaskConical className="size-3.5 shrink-0" />
          {variant === 'full' ? <span className="truncate">Resultados dummy</span> : null}
        </Button>
      }
    />
  )
}

function TournamentActionsToolbar({
  tournament,
  renameSaving,
  onRenameSave,
  closePending,
  onCloseConfirm,
  layout,
}: {
  tournament: Tournament
  renameSaving: boolean
  onRenameSave: (name: string) => Promise<void>
  closePending: boolean
  onCloseConfirm: () => void
  layout: 'table' | 'card'
}) {
  const finished = tournament.status === 'finished'

  if (layout === 'table') {
    return (
      <div
        role="toolbar"
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
          id={`admin-tournament-link-groups-${tournament.id}`}
          data-name={`groupsRr-${tournament.id}`}
          to={`/admin/groups?tournament=${tournament.id}`}
          className={buttonVariants({
            variant: 'outline',
            size: 'sm',
            className: 'h-7 shrink-0 gap-1 px-2 text-[0.8rem]',
          })}
        >
          <Grid3x3 className="size-3.5 shrink-0" />
          Grupos
        </Link>
        <Link
          id={`admin-tournament-link-dashboard-${tournament.id}`}
          data-name={`viewDashboard-${tournament.id}`}
          to="/dashboard"
          title="Ver en inicio"
          aria-label="Ver en inicio"
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm', className: 'shrink-0 text-slate-600' })}
        >
          <Eye className="size-3.5" />
        </Link>
        <AdminSeedDummyResultsButton tournamentId={tournament.id} variant="icon" />
        <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-slate-200 sm:inline-block" aria-hidden />
        <AdminConfirmDialog
          title="¿Cerrar torneo?"
          description="El torneo pasará a estado finalizado. Los resultados seguirán visibles para consulta."
          confirmLabel="Cerrar torneo"
          disabled={closePending || finished}
          onConfirm={onCloseConfirm}
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
    <div role="toolbar" aria-label={`Acciones del torneo ${tournament.name}`} className="flex flex-col gap-2">
      <RenameTournamentModal tournament={tournament} saving={renameSaving} onSave={onRenameSave} density="comfortable" />
      <Link
        id={`admin-tournament-mobile-link-groups-${tournament.id}`}
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
      <div className="grid grid-cols-2 gap-2">
        <Link
          id={`admin-tournament-mobile-link-dashboard-${tournament.id}`}
          data-name={`viewDashboardMobile-${tournament.id}`}
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: 'inline-flex h-9 w-full justify-center gap-2 text-slate-700',
          })}
          to="/dashboard"
        >
          <Eye className="size-3.5 shrink-0" />
          Ver en inicio
        </Link>
        <div className="flex min-w-0 items-stretch">
          <AdminSeedDummyResultsButton tournamentId={tournament.id} variant="full" triggerClassName="h-9 w-full" />
        </div>
      </div>
      <AdminConfirmDialog
        title="¿Cerrar torneo?"
        description="El torneo pasará a estado finalizado. Los resultados seguirán visibles para consulta."
        confirmLabel="Cerrar torneo"
        disabled={closePending || finished}
        onConfirm={onCloseConfirm}
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
    mutationFn: async (values: {
      name: string
      category: string
      initialGroups: 'none' | 'per_category'
    }) => {
      if (!userId) throw new Error('No autenticado')
      return createTournament({
        name: values.name,
        category: values.category,
        status: 'draft',
        createdBy: userId,
        initialGroups: values.initialGroups,
      })
    },
    onSuccess: async (result) => {
      const msg =
        result.groupsCreated > 0
          ? `Torneo creado con ${result.groupsCreated} grupo(s) en la base de datos`
          : 'Torneo creado'
      toast.success(msg)
      if (import.meta.env.DEV) {
        console.log('[AdminTournamentsPage] createTournament', {
          tournamentId: result.tournament.id,
          groupsCreated: result.groupsCreated,
        })
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
        qc.invalidateQueries({ queryKey: ['admin-groups'] }),
        qc.invalidateQueries({ queryKey: ['group-categories'] }),
        qc.invalidateQueries({ queryKey: ['tournaments'] }),
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
      className: 'align-middle whitespace-nowrap',
      render: (tournament) => (
        <TournamentActionsToolbar
          tournament={tournament}
          renameSaving={renameMut.isPending}
          onRenameSave={(name) => renameMut.mutateAsync({ id: tournament.id, name })}
          closePending={closeMut.isPending}
          onCloseConfirm={() => closeMut.mutate(tournament.id)}
          layout="table"
        />
      ),
    },
  ]

  const overview = overviewQ.data

  return (
    <div id="page-admin-tournaments" className="space-y-5 sm:space-y-8 md:space-y-10">
      <AdminPageHeader
        eyebrow="Administración"
        title="Torneos"
        description="Gestiona torneos y revisa el estado operativo (grupos, cruces y resultados)."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <Link
              to="/admin/next-tournament"
              className={buttonVariants({ variant: 'outline', className: 'w-full justify-center sm:w-auto' })}
            >
              <ArrowRightLeft className="size-4" />
              Crear siguiente torneo
            </Link>
            <CreateTournamentModal disabled={hasOpenTournament} onCreate={(values) => createMut.mutate(values)} />
          </div>
        }
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
                  <div className="border-t border-[#E2E8F0] pt-3">
                    <TournamentActionsToolbar
                      tournament={tournament}
                      renameSaving={renameMut.isPending}
                      onRenameSave={(name) => renameMut.mutateAsync({ id: tournament.id, name })}
                      closePending={closeMut.isPending}
                      onCloseConfirm={() => closeMut.mutate(tournament.id)}
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
