import { PLY_COPY } from '@/lib/playerDashboardCopy'
import { cn } from '@/lib/utils'

type Props = {
  played: number
  totalExpected: number
  className?: string
}

export function PlayerProgressCard(props: Props) {
  const { played, totalExpected, className } = props
  const total = Math.max(1, totalExpected)
  const pct = Math.min(100, Math.round((played / total) * 100))

  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] p-4 shadow-[var(--tdash-shadow)] md:p-5',
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[var(--tdash-text)]">{PLY_COPY.progressLabel}</p>
        <p className="text-sm tabular-nums text-[var(--tdash-muted)]">
          <span className="font-mono font-bold text-[var(--tdash-primary)]">{played}</span>
          <span> de </span>
          <span className="font-mono font-semibold text-[var(--tdash-text)]">{total}</span>
          <span> partidos</span>
        </p>
      </div>
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[var(--tdash-surface-2)] ring-1 ring-inset ring-[var(--tdash-border)]/80"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${PLY_COPY.progressLabel}: ${pct} por ciento`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--tdash-primary)] to-[var(--tdash-primary-hover)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
