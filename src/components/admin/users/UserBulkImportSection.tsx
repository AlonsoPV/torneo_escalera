import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'

import { BulkImportWizard } from '@/components/admin/users/BulkImportWizard'

export function UserBulkImportSection() {
  return (
    <section className="space-y-5" aria-labelledby="bulk-import-heading">
      <AdminSectionTitle
        id="bulk-import-heading"
        title="Carga masiva de usuarios"
        description="Flujo guiado paso a paso: sube tu archivo, valida filas y categorías, confirma e importa con progreso en tiempo real y descarga de resultados."
      />
      <BulkImportWizard />
    </section>
  )
}
