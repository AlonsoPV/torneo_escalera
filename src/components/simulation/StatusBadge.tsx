import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Variant = 'normal' | 'default' | 'muted' | 'review'

export function StatusBadge(props: { children: ReactNode; variant?: Variant; className?: string }) {
  const { children, variant = 'muted', className } = props
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        variant === 'normal' &&
          'bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
        variant === 'default' &&
          'bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
        variant === 'review' &&
          'bg-rose-500/15 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100',
        variant === 'muted' && 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}
