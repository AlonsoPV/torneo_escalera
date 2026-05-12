import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { MatchResultsImportWizard } from '@/components/admin/match-results/MatchResultsImportWizard'

export function AdminMatchResultsImportPage() {
  return (
    <div className="space-y-5 sm:space-y-8 md:space-y-10">
      <AdminPageHeader
        eyebrow="Administración"
        title="Importar resultados"
        description="Actualiza marcadores y estados de partidos existentes desde un CSV estructurado."
      />

      <section className="space-y-5" aria-labelledby="match-results-import-heading">
        <AdminSectionTitle
          id="match-results-import-heading"
          title="Importación guiada"
          description="Mismo ritmo que la carga masiva de usuarios: sube el archivo, valida contra tus torneos, confirma y revisa el informe final."
        />
        <MatchResultsImportWizard />
      </section>
    </div>
  )
}
