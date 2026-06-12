import {
  AlertTriangle,
  CalendarClock,
  Flag,
  Sparkles,
  ListChecks,
  Trophy,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminMetricCard, ADMIN_METRIC_GRID_4 } from '@/components/admin/shared/AdminMetricCard'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { buildAdminMatchDetailUrl } from '@/lib/adminStaffNotificationLinks'
import { getAdminOverviewData } from '@/services/admin'
import { listTournaments } from '@/services/tournaments'
import { cn } from '@/lib/utils'
import type { Tournament } from '@/types/database'

const quickActions = [
  { id: 'admin-overview-link-users', dataName: 'quick-nav-users', label: 'Ir a usuarios', href: '/admin/users' },
  { id: 'admin-overview-link-groups', dataName: 'quick-nav-groups', label: 'Ir a grupos', href: '/admin/groups' },
  { id: 'admin-overview-link-matches', dataName: 'quick-nav-matches', label: 'Ir a partidos', href: '/admin/matches' },
  { id: 'admin-overview-link-overview', dataName: 'quick-nav-overview', label: 'Ir a resumen general', href: '/admin/overview' },
] as const

function pickDefaultTournamentId(rows: Tournament[]): string {
  const act = rows
    .filter((t) => t.status === 'active')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (act[0]) return act[0].id
  const draft = rows
    .filter((t) => t.status === 'draft')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (draft[0]) return draft[0].id
  const rest = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return rest[0]?.id ?? ''
}

function tournamentSelectLabel(t: Tournament): string {
  const st =
    t.status === 'active' ? 'Activo' : t.status === 'draft' ? 'Borrador' : t.status === 'finished' ? 'Finalizado' : 'Archivado'
  return `${t.name} · ${st}`
}

export function AdminOverviewPage() {
  const tournamentsQ = useQuery({
    queryKey: ['admin-tournaments'],
    queryFn: listTournaments,
    staleTime: 5 * 60_000,
  })
  const [userTournamentOverride, setUserTournamentOverride] = useState<string | null>(null)

  const selectedTournamentId = useMemo(() => {
    const rows = tournamentsQ.data ?? []
    if (!rows.length) return ''
    if (userTournamentOverride && rows.some((t) => t.id === userTournamentOverride)) {
      return userTournamentOverride
    }
    return pickDefaultTournamentId(rows)
  }, [tournamentsQ.data, userTournamentOverride])

  const tournamentOptions = useMemo(() => {
    const rows = tournamentsQ.data ?? []
    const open = rows.filter((t) => t.status === 'draft' || t.status === 'active')
    const rest = rows.filter((t) => t.status !== 'draft' && t.status !== 'active')
    const byName = (a: Tournament, b: Tournament) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    return [...open.sort(byName), ...rest.sort(byName)]
  }, [tournamentsQ.data])

  const overviewQ = useQuery({
    queryKey: ['admin-overview', selectedTournamentId],
    queryFn: () => getAdminOverviewData(selectedTournamentId),
    enabled: Boolean(selectedTournamentId),
    staleTime: 60_000,
  })

  const selectedTournament = useMemo(
    () => (tournamentsQ.data ?? []).find((t) => t.id === selectedTournamentId) ?? null,
    [tournamentsQ.data, selectedTournamentId],
  )

  const openFromList = useMemo(
    () =>
      (tournamentsQ.data ?? [])
        .filter((t) => t.status === 'draft' || t.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [tournamentsQ.data],
  )

  const overview = overviewQ.data

  return (
    <div id="page-admin-overview" className="space-y-5 sm:space-y-8 md:space-y-10">
      <AdminPageHeader
        eyebrow="Administración"
        title="Vista general"
        description="Filtra por torneo para ver jugadores, grupos, partidos y pendientes sólo de esa competición."
      />

      {tournamentsQ.isLoading ? (
        <div id="admin-overview-loading" className="space-y-5 sm:space-y-8">
          <Skeleton className="h-8 max-w-md rounded-lg" />
          <div className={ADMIN_METRIC_GRID_4} role="status" aria-live="polite">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[5.5rem] rounded-2xl sm:h-24" />
            ))}
          </div>
        </div>
      ) : tournamentsQ.isError ? (
        <AdminEmptyState
          title="No se pudo cargar la lista de torneos."
          description={
            tournamentsQ.error instanceof Error
              ? tournamentsQ.error.message
              : 'Revisa tu conexión o permisos de administrador.'
          }
          icon={AlertTriangle}
        />
      ) : !tournamentsQ.data?.length ? (
        <AdminEmptyState
          title="Ningún torneo en el sistema."
          description="Crea uno en Administración → Torneos para empezar a operar."
          icon={Trophy}
        />
      ) : !selectedTournamentId || overviewQ.isLoading ? (
        <div id="admin-overview-loading" className="space-y-5 sm:space-y-8">
          <Skeleton className="h-8 max-w-md rounded-lg" />
          <div className={ADMIN_METRIC_GRID_4} role="status" aria-live="polite">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[5.5rem] rounded-2xl sm:h-24" />
            ))}
          </div>
        </div>
      ) : overviewQ.isError ? (
        <AdminEmptyState
          title="No se pudo cargar el resumen."
          description={
            overviewQ.error instanceof Error
              ? overviewQ.error.message
              : 'Revisa tu conexión o permisos de administrador.'
          }
          icon={AlertTriangle}
        />
      ) : overview ? (
        <>
          <section
            id="section-admin-overview-summary"
            className="scroll-mt-3 space-y-3 rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm sm:space-y-4 sm:rounded-2xl sm:p-4"
            aria-labelledby="overview-op-heading"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <AdminSectionTitle
                id="overview-op-heading"
                density="compact"
                title="Resumen operativo"
                description={`Datos sólo para el torneo seleccionado${
                  selectedTournament
                    ? `: «${selectedTournament.name}» (${selectedTournament.status === 'draft' ? 'borrador' : selectedTournament.status === 'active' ? 'activo' : selectedTournament.status === 'finished' ? 'finalizado' : 'archivado'}).`
                    : '.'
                }`}
              />
              <div className="flex w-full min-w-[min(100%,20rem)] flex-col gap-1.5 sm:w-auto sm:shrink-0">
                <Label htmlFor="admin-overview-tournament-filter" className="text-xs font-medium text-slate-600">
                  Torneo a visualizar
                </Label>
                <Select
                  value={selectedTournamentId}
                  onValueChange={(v) => setUserTournamentOverride(v || null)}
                >
                  <SelectTrigger id="admin-overview-tournament-filter" className="w-full sm:min-w-[16rem]" size="sm">
                    <SelectValue placeholder="Elegir torneo">
                      {selectedTournament ? tournamentSelectLabel(selectedTournament) : '—'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {tournamentOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id} label={tournamentSelectLabel(t)}>
                        <span className="flex flex-col gap-0.5 text-left sm:flex-row sm:items-center sm:gap-2">
                          <span className="font-medium">{t.name}</span>
                          <AdminStatusBadge status={t.status} className="w-fit shrink-0 text-[10px]" />
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-700 sm:py-2.5"
              role="status"
              aria-live="polite"
            >
              <p className="font-semibold text-slate-800">Torneos abiertos (borrador o activo)</p>
              {openFromList.length === 0 ? (
                <p className="mt-1 leading-relaxed text-slate-600">
                  No hay ninguno en borrador o activo. Puedes seguir usando el selector para revisar torneos finalizados u
                  archivados.
                </p>
              ) : (
                <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-slate-700 sm:gap-1.5">
                  {openFromList.map((t) => (
                    <li key={t.id} className="text-pretty">
                      <span className="font-medium">{t.name}</span>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <AdminStatusBadge status={t.status} className="align-middle text-[10px]" />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div id="admin-overview-metrics-summary" className={cn(ADMIN_METRIC_GRID_4, 'max-sm:gap-2.5')}>
              <AdminMetricCard
                label="Total de jugadores"
                value={overview.totalPlayers}
                icon={Users}
                tone="neutral"
                descriptionMode="info"
                description="Usuarios distintos inscritos en grupos de este torneo"
              />
              <AdminMetricCard
                label="Total de grupos"
                value={overview.totalGroups}
                icon={Flag}
                tone="info"
                descriptionMode="info"
                description="Grupos de este torneo"
              />
              <AdminMetricCard
                label="Total de partidos"
                value={overview.totalMatches}
                icon={CalendarClock}
                tone="neutral"
                descriptionMode="info"
                description="Partidos de este torneo"
              />
              <AdminMetricCard
                label="Partidos jugados"
                value={overview.playedMatches}
                icon={ListChecks}
                tone="success"
                descriptionMode="info"
                description="Con marcador enviado y confirmado por el rival o cerrado como oficial (fuera del estado sin marcador o solo provisional pendiente)."
              />
            </div>
          </section>

          <div id="admin-overview-panels-top">
            <Card
              id="card-admin-overview-quick-actions"
              className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-white shadow-sm ring-1 ring-emerald-900/[0.04]"
            >
              <CardHeader className="pb-2">
                <CardTitle
                  id="admin-overview-quick-actions-title"
                  className="flex items-center gap-2 text-base font-semibold text-slate-900"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Sparkles className="size-4" />
                  </span>
                  Acciones rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                {quickActions.map((action, index) => (
                  <Link
                    key={action.href}
                    id={action.id}
                    data-name={action.dataName}
                    to={action.href}
                    className={cn(
                      buttonVariants({ variant: index === 0 ? 'default' : 'outline', size: 'lg' }),
                      'h-11 w-full justify-center',
                      index === 0
                        ? 'shadow-sm shadow-emerald-900/10'
                        : 'border-slate-300/80 bg-white/90 hover:bg-emerald-50/40',
                    )}
                  >
                    {action.label}
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          <div id="admin-overview-panels-bottom" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card id="card-admin-overview-recent-activity" className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle id="admin-overview-recent-title" className="text-base font-semibold text-slate-900">
                  Actividad reciente
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Torneo seleccionado: {selectedTournament?.name ?? '—'}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.recentMatches.length === 0 ? (
                  <p className="text-sm text-slate-500">Aún no hay actividad reciente para este torneo.</p>
                ) : (
                  overview.recentMatches.map((match) => (
                    <Link
                      key={match.id}
                      id={`admin-overview-recent-match-${match.id}`}
                      to={buildAdminMatchDetailUrl({
                        tournamentId: match.tournament_id,
                        matchId: match.id,
                      })}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3 transition-colors hover:border-emerald-200/80 hover:bg-emerald-50/30 sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-pretty text-sm font-medium text-slate-900">
                          {match.playerAName} vs {match.playerBName}
                        </p>
                        <p className="text-xs text-slate-500">{match.groupName}</p>
                      </div>
                      <div className="shrink-0">
                        <AdminStatusBadge status={match.status} />
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card id="card-admin-overview-pending-review" className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle id="admin-overview-pending-title" className="text-base font-semibold text-slate-900">
                  Pendientes de revisión
                </CardTitle>
                <p className="text-xs text-slate-500">Alcance: {selectedTournament?.name ?? '—'}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.pendingActions.length === 0 ? (
                  <AdminEmptyState
                    title="Todo al día."
                    description="No hay alertas operativas en este momento para este torneo."
                    icon={Trophy}
                  />
                ) : (
                  overview.pendingActions.map((action, index) => (
                    <div
                      key={`${index}-${action.message.slice(0, 48)}`}
                      id={`admin-overview-pending-action-${index}`}
                      className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-3 text-sm text-amber-900"
                    >
                      <p className="leading-relaxed">{action.message}</p>
                      {action.href ? (
                        <Link
                          to={action.href}
                          id={`admin-overview-pending-action-link-${index}`}
                          className={cn(
                            buttonVariants({ variant: 'link', size: 'sm' }),
                            'mt-2 h-auto px-0 text-amber-950 underline underline-offset-2 hover:text-amber-900',
                          )}
                        >
                          Ir a revisión y detalle
                        </Link>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <AdminEmptyState
          title="No se pudo cargar la vista general."
          description="Revisa tu conexión o permisos de administrador."
          icon={AlertTriangle}
        />
      )}
    </div>
  )
}
