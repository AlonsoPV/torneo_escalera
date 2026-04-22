import { LineChart } from 'lucide-react'

import { PLY_COPY } from '@/lib/playerDashboardCopy'
import { cn } from '@/lib/utils'

type Props = {
  lines: string[]
  className?: string
}

export function PerformanceInsightCard(props: Props) {
  const { lines, className } = props
  if (lines.length === 0) return null

  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] p-3 shadow-[var(--tdash-shadow)] sm:rounded-2xl sm:p-4',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-bold text-[var(--tdash-text)] sm:text-sm">
        <LineChart className="size-3.5 shrink-0 text-[var(--tdash-primary)] sm:size-4" aria-hidden />
        {PLY_COPY.insightsTitle}
      </div>
      <ul className="mt-2.5 list-outside list-disc space-y-1.5 pl-4 text-xs text-[var(--tdash-muted)] marker:text-[var(--tdash-muted)] sm:mt-3 sm:list-inside sm:pl-0 sm:text-sm">
        {lines.map((line) => (
          <li key={line} className="leading-snug">
            {line}
          </li>
        ))}
      </ul>
    </section>
  )
}
