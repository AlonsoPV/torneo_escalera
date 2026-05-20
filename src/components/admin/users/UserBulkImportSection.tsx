import { ChevronDown, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'

import { BulkImportWizard } from '@/components/admin/users/BulkImportWizard'
import { cn } from '@/lib/utils'

export function UserBulkImportSection() {
  const [open, setOpen] = useState(false)

  return (
    <section aria-label="Importación masiva de usuarios">
      <details
        className="group border-t border-slate-200/80 bg-slate-50/30 open:bg-white"
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary
          className={cn(
            'flex cursor-pointer list-none items-center gap-3 px-4 py-4 outline-none transition-colors sm:gap-4 sm:px-5 sm:py-4',
            'hover:bg-slate-50/90 focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/30 focus-visible:ring-offset-2',
            '[&::-webkit-details-marker]:hidden',
          )}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100/90 text-amber-800 shadow-sm ring-1 ring-amber-900/[0.06] sm:size-11">
            <FileSpreadsheet className="size-5 sm:size-[1.35rem]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-semibold text-slate-900 sm:text-base">Carga masiva desde Excel</span>
            <span className="mt-0.5 block text-xs leading-snug text-slate-500 sm:text-sm">
              Asistente en pasos, validación de filas, importación con progreso y descarga de resultados.
            </span>
          </span>
          <ChevronDown
            className={cn('size-5 shrink-0 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
            aria-hidden
          />
        </summary>
        <div className="border-t border-slate-100 px-3 pb-4 pt-1 sm:px-4 sm:pb-5 sm:pt-2">
          <BulkImportWizard />
        </div>
      </details>
    </section>
  )
}
