import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type MetricTone = 'neutral' | 'blue' | 'emerald' | 'amber' | 'red'

const toneStyles: Record<MetricTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
}

const progressStyles: Record<MetricTone, string> = {
  neutral: 'bg-slate-500',
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

export function TournamentMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  progressPercent,
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: LucideIcon
  tone?: MetricTone
  progressPercent?: number
  className?: string
}) {
  const progress = progressPercent == null ? null : Math.max(0, Math.min(100, progressPercent))

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/60 bg-card p-3 shadow-sm transition-colors hover:border-border sm:p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs">
            {label}
          </p>
          <div className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </div>
          {hint ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', toneStyles[tone])}>
            <Icon className="size-5" aria-hidden />
          </span>
        ) : null}
      </div>
      {progress != null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full transition-all', progressStyles[tone])} style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  )
}
