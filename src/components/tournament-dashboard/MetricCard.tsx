import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  label: string
  value: string | number
  icon?: ReactNode
  className?: string
}

export function MetricCard(props: Props) {
  const { label, value, icon, className } = props
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] p-4 shadow-[var(--tdash-shadow)] transition-shadow duration-200 hover:shadow-[var(--tdash-shadow-lg)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tdash-muted)]">
          {label}
        </p>
        {icon ? <span className="text-[var(--tdash-muted)] opacity-80">{icon}</span> : null}
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-[var(--tdash-text)]">
        {value}
      </p>
    </div>
  )
}
