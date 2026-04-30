import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Barra de filtros / acciones con estilo tipo app (stack en móvil). */
export function AdminToolbar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm sm:p-5',
        'flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end',
        className,
      )}
    >
      {children}
    </div>
  )
}
