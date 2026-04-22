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
        'rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] p-3 shadow-[var(--tdash-shadow)] sm:rounded-2xl sm:p-4 md:p-5',
        className,
      )}
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <p className="text-xs font-semibold text-[var(--tdash-text)] sm:text-sm">{PLY_COPY.progressLabel}</p>
        <p className="text-xs tabular-nums text-[var(--tdash-muted)] sm:text-sm">
          <span className="font-mono font-bold text-[var(--tdash-primary)]">{played}</span>
          <span> de </span>
          <span className="font-mono font-semibold text-[var(--tdash-text)]">{total}</span>
          <span> partidos</span>
        </p>
      </div>
      <div
        className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--tdash-surface-2)] ring-1 ring-inset ring-[var(--tdash-border)]/80 sm:mt-3 sm:h-2.5"
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
