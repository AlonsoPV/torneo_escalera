import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Flag,
  Sparkles,
  ListChecks,
  Trophy,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminMetricCard, ADMIN_METRIC_GRID_4 } from '@/components/admin/shared/AdminMetricCard'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getAdminOverviewData } from '@/services/admin'

const quickActions = [
  { id: 'admin-overview-link-groups', dataName: 'quick-nav-groups', label: 'Crear grupo', href: '/admin/groups' },
  { id: 'admin-overview-link-users', dataName: 'quick-nav-users', label: 'Agregar usuario', href: '/admin/users' },
  { id: 'admin-overview-link-matches', dataName: 'quick-nav-matches', label: 'Partidos', href: '/admin/matches' },
  { id: 'admin-overview-link-results', dataName: 'quick-nav-results', label: 'Resultados', href: '/admin/results' },
  { id: 'admin-overview-link-dashboard', dataName: 'quick-nav-dashboard', label: 'Ver ranking', href: '/dashboard' },
] as const

export function AdminOverviewPage() {
  const [pendingSectionOpen, setPendingSectionOpen] = useState(false)
  const overviewQ = useQuery({
    queryKey: ['admin-overview'],
    queryFn: getAdminOverviewData,
  })

  return (
    <div id="page-admin-overview" className="space-y-5 sm:space-y-8 md:space-y-10">
      <AdminPageHeader
        eyebrow="Administración"
        title="Vista general"
        description="Estado operativo del torneo: métricas clave, pendientes y accesos rápidos para actuar sin perder contexto."
      />

      {overviewQ.isLoading ? (
        <div id="admin-overview-loading" className="space-y-5 sm:space-y-8">
          <Skeleton className="h-8 max-w-md rounded-lg" />
          <div className={ADMIN_METRIC_GRID_4} role="status" aria-live="polite">
            {Array.from({ length: 9 }).map((_, index) => (
              <Skeleton key={index} className="h-[5.5rem] rounded-2xl sm:h-24" />
            ))}
          </div>
        </div>
      ) : overviewQ.isError ? (
        <AdminEmptyState
          title="No se pudo cargar la vista general."
          description={
            overviewQ.error instanceof Error
              ? overviewQ.error.message
              : 'Revisa tu conexión o permisos de administrador.'
          }
          icon={AlertTriangle}
        />
      ) : overviewQ.data ? (
        <>
          <section
            id="section-admin-overview-summary"
            className="scroll-mt-3 space-y-2 rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm sm:space-y-3 sm:rounded-2xl sm:p-4"
            aria-labelledby="overview-op-heading"
          >
            <AdminSectionTitle
              id="overview-op-heading"
              density="compact"
              title="Resumen operativo"
              description="Capacidad del club: jugadores, estructura de grupos y volumen de partidos."
            />
            <div id="admin-overview-metrics-summary" className={cn(ADMIN_METRIC_GRID_4, 'max-sm:gap-2.5')}>
              <AdminMetricCard
                label="Total de jugadores"
                value={overviewQ.data.totalPlayers}
                icon={Users}
                tone="neutral"
                description="Perfiles con rol jugador"
              />
              <AdminMetricCard
                label="Total de grupos"
                value={overviewQ.data.totalGroups}
                icon={Flag}
                tone="info"
                description="Grupos creados en torneos"
              />
              <AdminMetricCard
                label="Total de partidos"
                value={overviewQ.data.totalMatches}
                icon={CalendarClock}
                tone="neutral"
                description="Cruces generados en el sistema"
              />
              <AdminMetricCard
                label="Torneos activos"
                value={overviewQ.data.activeTournaments}
                icon={Trophy}
                tone="success"
                description={`De ${overviewQ.data.totalTournaments} torneo(s) registrados`}
              />
            </div>
          </section>

          <section
            id="section-admin-overview-pending"
            className="scroll-mt-3 rounded-xl border border-amber-200/70 bg-gradient-to-b from-amber-50/35 to-white p-3 shadow-sm ring-1 ring-amber-900/[0.04] sm:rounded-2xl sm:p-4 sm:ring-amber-900/[0.03]"
            aria-label="Pendientes y cierre"
          >
            <details onToggle={(event) => setPendingSectionOpen(event.currentTarget.open)}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-lg py-0.5 text-left outline-none [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white">
                <div className="min-w-0 flex-1 pr-1">
                  <h3
                    id="overview-risk-heading"
                    className="text-sm font-semibold leading-snug tracking-tight text-slate-900 sm:text-[0.9375rem]"
                  >
                    Pendientes y cierre
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500 sm:text-xs">
                    <span className="max-sm:inline sm:hidden">Toca para ver métricas de marcadores y cierre.</span>
                    <span className="hidden sm:inline">Métricas de marcadores pendientes y cierre administrativo.</span>
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'mt-0.5 size-5 shrink-0 text-amber-800/70 transition-transform duration-200',
                    pendingSectionOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </summary>
              <div className="mt-3 border-t border-amber-200/60 pt-3 sm:mt-3 sm:pt-3">
                <p className="mb-3 hidden text-xs leading-relaxed text-slate-500 sm:block">
                  Revisa marcadores pendientes, grupos incompletos y resultados listos para cierre.
                </p>
                <div
                  id="admin-overview-metrics-pending"
                  className={cn(
                    'max-sm:flex max-sm:flex-col max-sm:gap-2',
                    'sm:grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-5',
                  )}
                >
                  <AdminMetricCard
                    label="Pendientes de marcador"
                    value={overviewQ.data.matchesWithoutDate}
                    icon={CalendarClock}
                    tone="warning"
                    description="Cruces disponibles para captura"
                  />
                  <AdminMetricCard
                    label="Grupos incompletos"
                    value={overviewQ.data.incompleteGroups}
                    icon={ListChecks}
                    tone="warning"
                    description="Por debajo del cupo configurado"
                  />
                  <AdminMetricCard
                    label="Resultados pendientes"
                    value={overviewQ.data.pendingResults}
                    icon={AlertTriangle}
                    tone="warning"
                    description="Marcador enviado, falta confirmar"
                  />
                  <AdminMetricCard
                    label="Partidos jugados"
                    value={overviewQ.data.playedMatches}
                    icon={CheckCircle2}
                    tone="success"
                    description="Confirmados o corregidos"
                  />
                  <AdminMetricCard
                    className="max-sm:w-full sm:col-span-2 xl:col-span-1"
                    label="Resultados confirmados"
                    value={overviewQ.data.confirmedResults}
                    icon={CheckCircle2}
                    tone="success"
                    description="Cerrados por administración"
                  />
                </div>
              </div>
            </details>
          </section>

          <div id="admin-overview-panels-top" className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card id="card-admin-overview-health" className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle id="admin-overview-health-title" className="text-base font-semibold text-slate-900">
                  Salud del torneo
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50/90 p-4 ring-1 ring-slate-200/60">
                  <p className="text-xs font-medium text-slate-500">Operación</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {overviewQ.data.pendingActions.length === 0 ? 'Sin alertas críticas' : 'Requiere atención'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50/90 p-4 ring-1 ring-slate-200/60">
                  <p className="text-xs font-medium text-slate-500">Siguiente foco</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {overviewQ.data.pendingResults > 0 ? 'Revisar resultados' : 'Ver cruces'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50/90 p-4 ring-1 ring-slate-200/60">
                  <p className="text-xs font-medium text-slate-500">Pendientes</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{overviewQ.data.pendingActions.length}</p>
                </div>
              </CardContent>
            </Card>

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
                      index === 0
                        ? 'h-11 w-full justify-center shadow-sm shadow-emerald-900/10 sm:col-span-2'
                        : 'h-11 w-full justify-center border-slate-300/80 bg-white/90 hover:bg-emerald-50/40',
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
              </CardHeader>
              <CardContent className="space-y-2">
                {overviewQ.data.recentMatches.length === 0 ? (
                  <p className="text-sm text-slate-500">Aún no hay actividad reciente.</p>
                ) : (
                  overviewQ.data.recentMatches.map((match) => (
                    <div
                      key={match.id}
                      id={`admin-overview-recent-match-${match.id}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3 sm:items-center"
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
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card id="card-admin-overview-pending-review" className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle id="admin-overview-pending-title" className="text-base font-semibold text-slate-900">
                  Pendientes de revisión
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overviewQ.data.pendingActions.length === 0 ? (
                  <AdminEmptyState
                    title="Todo al día."
                    description="No hay alertas operativas en este momento."
                    icon={Trophy}
                  />
                ) : (
                  overviewQ.data.pendingActions.map((action, index) => (
                    <div
                      key={action}
                      id={`admin-overview-pending-action-${index}`}
                      className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-3 text-sm text-amber-900"
                    >
                      {action}
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
