import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  /** `id` del encabezado (para `aria-labelledby` de la sección contenedora). */
  headingId: string
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/**
 * Encabezado reutilizable para secciones del tablero del jugador (actividad, matriz, etc.).
 */
export function DashboardSectionHeader(props: Props) {
  const { headingId, eyebrow, title, description, action, className } = props

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-[var(--tdash-border)]/80 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tdash-primary)]">
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={headingId}
          className={cn(
            'font-bold tracking-tight text-[var(--tdash-text)]',
            eyebrow ? 'mt-1' : null,
            'text-base sm:text-lg',
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--tdash-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1.5 sm:gap-x-4">
          {action}
        </div>
      ) : null}
    </div>
  )
}
