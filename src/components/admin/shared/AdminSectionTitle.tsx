import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function AdminSectionTitle({
  title,
  description,
  action,
  className,
  id,
  density = 'default',
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  id?: string
  /** `compact`: menos aire, copy más breve en móvil (bloques tipo dashboard). */
  density?: 'default' | 'compact'
}) {
  const isCompact = density === 'compact'

  return (
    <div
      className={cn(
        'flex flex-col border-b border-slate-200/80 sm:flex-row sm:justify-between',
        isCompact
          ? 'gap-1 border-slate-200/70 pb-2 sm:items-baseline sm:gap-3 sm:pb-2.5'
          : 'gap-2 pb-3 sm:items-end sm:gap-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h3
          id={id}
          className={cn(
            'font-semibold tracking-tight text-slate-900',
            isCompact ? 'text-sm leading-snug sm:text-[0.9375rem]' : 'text-sm sm:text-base',
          )}
        >
          {title}
        </h3>
        {description ? (
          <p
            className={cn(
              'max-w-2xl text-slate-500',
              isCompact
                ? 'mt-0.5 line-clamp-2 text-[11px] leading-snug sm:mt-1 sm:line-clamp-none sm:text-xs sm:leading-relaxed'
                : 'mt-1 text-xs leading-relaxed sm:text-sm',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2 pt-0.5 sm:pt-0">{action}</div> : null}
    </div>
  )
}
