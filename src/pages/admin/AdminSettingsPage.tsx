import { ShieldCheck, SlidersHorizontal } from 'lucide-react'

import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Card, CardContent } from '@/components/ui/card'

export function AdminSettingsPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Configuración"
        title="Configuración del panel"
        description="Estado de seguridad, permisos y preparación de módulos administrativos."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-[#E2E8F0] bg-white shadow-sm">
          <CardContent className="space-y-3 p-5">
            <ShieldCheck className="size-6 text-[#1F5A4C]" />
            <h3 className="font-semibold text-[#102A43]">Acceso protegido</h3>
            <p className="text-sm leading-6 text-[#64748B]">
              Las rutas admin permanecen bajo autenticación y solo roles admin o super_admin pueden acceder.
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#E2E8F0] bg-white shadow-sm">
          <CardContent className="space-y-3 p-5">
            <SlidersHorizontal className="size-6 text-[#1F5A4C]" />
            <h3 className="font-semibold text-[#102A43]">Módulos preparados</h3>
            <p className="text-sm leading-6 text-[#64748B]">
              Usuarios, grupos, partidos, resultados, notificaciones y exportaciones tienen una base lista para crecer.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
