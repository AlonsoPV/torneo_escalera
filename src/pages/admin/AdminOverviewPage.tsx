import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Flag,
  ListChecks,
  Trophy,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getAdminOverviewData } from '@/services/admin'

const quickActions = [
  { label: 'Crear grupo', href: '/admin/groups' },
  { label: 'Agregar usuario', href: '/admin/users' },
  { label: 'Agendar partido', href: '/admin/matches' },
  { label: 'Revisar resultados', href: '/admin/results' },
  { label: 'Ver ranking', href: '/dashboard' },
]

export function AdminOverviewPage() {
  const overviewQ = useQuery({
    queryKey: ['admin-overview'],
    queryFn: getAdminOverviewData,
  })

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Vista general"
        title="Estado operativo del torneo"
        description="Monitorea grupos, partidos, resultados y pendientes desde un solo lugar."
      />

      {overviewQ.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : overviewQ.data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <AdminMetricCard label="Total de jugadores" value={overviewQ.data.totalPlayers} icon={Users} />
            <AdminMetricCard label="Total de grupos" value={overviewQ.data.totalGroups} icon={Flag} />
            <AdminMetricCard label="Total de partidos" value={overviewQ.data.totalMatches} icon={CalendarClock} />
            <AdminMetricCard
              label="Partidos sin fecha"
              value={overviewQ.data.matchesWithoutDate}
              icon={CalendarClock}
              tone="pending"
            />
            <AdminMetricCard
              label="Partidos jugados"
              value={overviewQ.data.playedMatches}
              icon={CheckCircle2}
              tone="success"
            />
            <AdminMetricCard
              label="Resultados pendientes"
              value={overviewQ.data.pendingResults}
              icon={AlertTriangle}
              tone="warning"
            />
            <AdminMetricCard
              label="Resultados confirmados"
              value={overviewQ.data.confirmedResults}
              icon={CheckCircle2}
              tone="success"
            />
            <AdminMetricCard
              label="Grupos incompletos"
              value={overviewQ.data.incompleteGroups}
              icon={ListChecks}
              tone="warning"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-[#E2E8F0] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-[#102A43]">Salud del torneo</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#F8FAFC] p-4">
                  <p className="text-sm text-[#64748B]">Torneos activos</p>
                  <p className="mt-2 text-2xl font-semibold text-[#102A43]">
                    {overviewQ.data.activeTournaments} / {overviewQ.data.totalTournaments}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#F8FAFC] p-4">
                  <p className="text-sm text-[#64748B]">Operación</p>
                  <p className="mt-2 font-semibold text-[#102A43]">
                    {overviewQ.data.pendingActions.length === 0 ? 'Sin pendientes críticos' : 'Requiere atención'}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#F8FAFC] p-4">
                  <p className="text-sm text-[#64748B]">Siguiente enfoque</p>
                  <p className="mt-2 font-semibold text-[#102A43]">
                    {overviewQ.data.pendingResults > 0 ? 'Revisar resultados' : 'Agendar partidos'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E2E8F0] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-[#102A43]">Acciones rápidas</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2">
                {quickActions.map((action, index) => (
                  <Link
                    key={action.href}
                    to={action.href}
                    className={cn(
                      buttonVariants({ variant: index === 0 ? 'default' : 'outline' }),
                      'w-full justify-start sm:w-auto',
                    )}
                  >
                    {action.label}
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="border-[#E2E8F0] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-[#102A43]">Actividad reciente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {overviewQ.data.recentMatches.length === 0 ? (
                  <p className="text-sm text-[#64748B]">Aún no hay actividad reciente.</p>
                ) : (
                  overviewQ.data.recentMatches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-start justify-between gap-3 rounded-2xl bg-[#F8FAFC] p-3 sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-pretty text-sm font-medium text-[#102A43]">
                          {match.playerAName} vs {match.playerBName}
                        </p>
                        <p className="text-xs text-[#64748B]">{match.groupName}</p>
                      </div>
                      <div className="shrink-0">
                        <AdminStatusBadge status={match.status} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-[#E2E8F0] bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-[#102A43]">Pendientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {overviewQ.data.pendingActions.length === 0 ? (
                  <AdminEmptyState
                    title="No hay resultados pendientes."
                    description="Todos los marcadores han sido revisados."
                    icon={Trophy}
                  />
                ) : (
                  overviewQ.data.pendingActions.map((action) => (
                    <div key={action} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
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
