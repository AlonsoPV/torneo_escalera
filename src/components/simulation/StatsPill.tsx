import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function StatsPill(props: { children: ReactNode; className?: string }) {
  const { children, className } = props
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm',
        className,
      )}
    >
      {children}
    </span>
  )
}
