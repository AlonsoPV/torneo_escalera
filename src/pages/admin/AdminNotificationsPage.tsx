import { AlertTriangle, Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getAdminOverviewData } from '@/services/admin'

export function AdminNotificationsPage() {
  const overviewQ = useQuery({
    queryKey: ['admin-overview'],
    queryFn: getAdminOverviewData,
  })

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Notificaciones"
        title="Notificaciones"
        description="Pendientes operativos detectados con la información actual de Supabase."
        actions={
          <Badge className="w-full justify-center rounded-full bg-[#C8A96B]/20 py-1.5 text-[#6E5521] sm:w-auto">
            Canal no configurado
          </Badge>
        }
      />

      {overviewQ.isLoading ? (
        <Skeleton className="h-44 rounded-2xl" />
      ) : overviewQ.data?.pendingActions.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overviewQ.data.pendingActions.map((action) => (
            <Card key={action} className="border-[#E2E8F0] bg-white shadow-sm">
              <CardContent className="space-y-4 p-5">
                <span className="inline-flex rounded-2xl bg-amber-50 p-3 text-amber-700">
                  <AlertTriangle className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-pretty font-semibold text-[#102A43]">{action}</h3>
                  <p className="mt-1 text-sm text-[#64748B]">
                    Este pendiente se calculó con los datos actuales del torneo.
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <AdminEmptyState
          title="No hay notificaciones operativas."
          description="No se detectaron pendientes con la información actual de Supabase."
          icon={Bell}
        />
      )}

      <Card className="border-dashed border-[#E2E8F0] bg-white/80">
        <CardContent className="flex flex-col gap-3 p-4 text-sm text-[#64748B] sm:flex-row sm:items-center sm:gap-4 sm:p-5">
          <Bell className="size-5 shrink-0 text-[#1F5A4C]" />
          <p className="min-w-0 leading-relaxed">
            Para enviar avisos reales falta configurar un canal de entrega en backend.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
