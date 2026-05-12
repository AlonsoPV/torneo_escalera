import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { NextTournamentWizard } from '@/components/admin/next-tournament/NextTournamentWizard'

export function NextTournamentPage() {
  return (
    <div id="page-admin-next-tournament" className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Administración"
        title="Siguiente torneo"
        description="Crea un torneo nuevo a partir de los resultados por grupo del anterior: ascensos, descensos, categorías y grupos (round robin solo en grupos de 5)."
      />
      <NextTournamentWizard />
    </div>
  )
}
