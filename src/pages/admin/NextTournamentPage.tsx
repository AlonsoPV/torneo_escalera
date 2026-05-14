import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { NextTournamentWizard } from '@/components/admin/next-tournament/NextTournamentWizard'
import { hasAdminNextTournamentRouteAccess } from '@/lib/adminNextTournamentRouteGate'

export function NextTournamentPage() {
  const navigate = useNavigate()
  const [allowed] = useState(() => hasAdminNextTournamentRouteAccess())

  useEffect(() => {
    if (!allowed) navigate('/admin/tournaments', { replace: true })
  }, [allowed, navigate])

  if (!allowed) return null

  return (
    <div id="page-admin-next-tournament" className="space-y-6 sm:space-y-8">
      <section id="section-admin-next-tournament-header" data-name="next-tournament-page-header">
        <AdminPageHeader
          eyebrow="Administración"
          title="Siguiente torneo"
          description="Crea un torneo nuevo a partir de los resultados por grupo del anterior: ascensos, descensos, categorías y grupos (round robin solo en grupos de 5)."
        />
      </section>
      <section id="section-admin-next-tournament-wizard" data-name="next-tournament-wizard-section">
        <NextTournamentWizard />
      </section>
    </div>
  )
}
