import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getAdminGroups, getAdminMatches, getAdminResults, getAdminUsers } from '@/services/admin'

export function AdminExportsPage() {
  const usersQ = useQuery({ queryKey: ['admin-users'], queryFn: getAdminUsers })
  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const matchesQ = useQuery({ queryKey: ['admin-matches'], queryFn: () => getAdminMatches() })
  const resultsQ = useQuery({ queryKey: ['admin-results'], queryFn: getAdminResults })

  const isLoading = usersQ.isLoading || groupsQ.isLoading || matchesQ.isLoading || resultsQ.isLoading
  const reports = [
    { title: 'Jugadores', count: (usersQ.data ?? []).filter((user) => user.role === 'player').length },
    { title: 'Grupos', count: groupsQ.data?.length ?? 0 },
    { title: 'Partidos', count: matchesQ.data?.length ?? 0 },
    { title: 'Resultados', count: resultsQ.data?.length ?? 0 },
    {
      title: 'Ranking',
      count: (matchesQ.data ?? []).filter((match) => ['confirmed', 'corrected'].includes(match.status)).length,
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Exportaciones"
        title="Exportaciones"
        description="Vista de reportes calculada con datos actuales de Supabase."
        actions={
          <Badge className="w-full justify-center rounded-full bg-[#C8A96B]/20 py-1.5 text-[#6E5521] sm:w-auto">
            Exportador no configurado
          </Badge>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((item) => (
            <Card key={item.title} className="border-[#E2E8F0] bg-white shadow-sm">
              <CardContent className="space-y-5 p-5">
                <span className="inline-flex rounded-2xl bg-[#F6F3EE] p-3 text-[#1F5A4C]">
                  <Download className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-[#102A43]">{item.title}</h3>
                  <p className="mt-1 text-sm text-[#64748B]">
                    {item.count} registros disponibles en Supabase.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button className="w-full sm:w-auto" disabled variant="outline">
                    <FileSpreadsheet className="size-4" />
                    Excel
                  </Button>
                  <Button className="w-full sm:w-auto" disabled variant="outline">
                    <FileText className="size-4" />
                    PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
