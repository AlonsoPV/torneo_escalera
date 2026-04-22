import { Trophy } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { StatsPill } from '@/components/simulation/StatsPill'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  category?: string
  season?: string
  statusLabel?: string
  stats?: { label: string; value: string }[]
  className?: string
}

export function TournamentHeader(props: Props) {
  const { title, category, season, statusLabel = 'Simulación', stats, className } = props

  return (
    <header
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-teal-50/40 p-5 shadow-sm dark:from-card dark:via-card dark:to-teal-950/30 sm:p-6',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-teal-500/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600/15 text-teal-800 shadow-sm dark:bg-teal-500/20 dark:text-teal-200">
            <Trophy className="size-6" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="max-w-3xl text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {category ? <span>{category}</span> : null}
              {category && season ? <span aria-hidden>·</span> : null}
              {season ? <span>{season}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="rounded-lg border-teal-500/20 bg-teal-500/10 px-3 py-1 text-teal-900 dark:text-teal-100"
          >
            {statusLabel}
          </Badge>
        </div>
      </div>
      {stats && stats.length > 0 ? (
        <div className="relative mt-5 flex flex-wrap gap-2 border-t border-border/50 pt-4">
          {stats.map((s) => (
            <StatsPill key={s.label}>
              <span className="text-foreground/80">{s.label}:</span>&nbsp;
              <span className="font-semibold text-foreground">{s.value}</span>
            </StatsPill>
          ))}
        </div>
      ) : null}
    </header>
  )
}
