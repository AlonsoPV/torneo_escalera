import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type DashboardBadgeVariant =
  | 'active'
  | 'finished'
  | 'win'
  | 'loss'
  | 'default'
  | 'neutral'

const variants: Record<DashboardBadgeVariant, string> = {
  active:
    'border-[var(--tdash-win-border)] bg-[var(--tdash-win-bg)] text-[var(--tdash-win-text)]',
  finished: 'border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] text-[var(--tdash-muted)]',
  win: 'border-[var(--tdash-win-border)] bg-[var(--tdash-win-bg)] text-[var(--tdash-win-text)]',
  loss: 'border-[var(--tdash-loss-border)] bg-[var(--tdash-loss-bg)] text-[var(--tdash-loss-text)]',
  default:
    'border-[var(--tdash-def-border)] bg-[var(--tdash-def-bg)] text-[var(--tdash-def-text)]',
  neutral: 'border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] text-[var(--tdash-muted)]',
}

type Props = {
  children: ReactNode
  variant?: DashboardBadgeVariant
  className?: string
}

export function DashboardStatusBadge(props: Props) {
  const { children, variant = 'neutral', className } = props
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
