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
        'rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] p-4 shadow-[var(--tdash-shadow)]',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-bold text-[var(--tdash-text)]">
        <LineChart className="size-4 text-[var(--tdash-primary)]" aria-hidden />
        {PLY_COPY.insightsTitle}
      </div>
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-[var(--tdash-muted)]">
        {lines.map((line) => (
          <li key={line} className="leading-snug">
            {line}
          </li>
        ))}
      </ul>
    </section>
  )
}
