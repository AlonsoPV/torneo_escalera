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
        'rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] p-3 shadow-[var(--tdash-shadow)] transition-shadow duration-200 hover:shadow-[var(--tdash-shadow-lg)] sm:rounded-2xl sm:p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tdash-muted)] sm:text-[11px]">
          {label}
        </p>
        {icon ? (
          <span className="shrink-0 text-[var(--tdash-muted)] opacity-80 [&_svg]:size-3.5 sm:[&_svg]:size-4">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 break-words text-pretty font-mono text-xl font-bold tracking-tight text-[var(--tdash-text)] tabular-nums sm:mt-2 sm:text-2xl">
        {value}
      </p>
    </div>
  )
}
