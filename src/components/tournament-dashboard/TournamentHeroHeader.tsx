import { Trophy } from 'lucide-react'

import { DashboardStatusBadge } from '@/components/tournament-dashboard/DashboardStatusBadge'
import { TDASH_COPY } from '@/lib/tournamentDashboardCopy'

type Props = {
  title?: string
  meta?: string
  statusLabel?: string
}

export function TournamentHeroHeader(props: Props) {
  const {
    title = TDASH_COPY.heroTitle,
    meta = TDASH_COPY.heroMeta,
    statusLabel = TDASH_COPY.status,
  } = props

  return (
    <header
      className="overflow-hidden rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] p-6 shadow-[var(--tdash-shadow-lg)] md:p-8"
      style={{ boxShadow: 'var(--tdash-shadow-lg)' }}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-5">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl md:size-16"
            style={{
              background: `linear-gradient(135deg, var(--tdash-primary) 0%, var(--tdash-primary-hover) 100%)`,
              boxShadow: '0 8px 24px rgba(22, 59, 101, 0.25)',
            }}
          >
            <Trophy className="size-7 text-white md:size-8" aria-hidden />
          </div>
          <div className="min-w-0 space-y-2">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-[var(--tdash-text)] md:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--tdash-muted)] md:text-base">
              {meta}
            </p>
          </div>
        </div>
        <div className="shrink-0 md:pt-1">
          <DashboardStatusBadge variant="active">{statusLabel}</DashboardStatusBadge>
        </div>
      </div>
      <p className="mt-6 border-t border-[var(--tdash-border)] pt-5 text-sm leading-relaxed text-[var(--tdash-muted)]">
        Panel profesional para consultar resultados por grupo, marcadores y clasificación en tiempo
        real (demo).
      </p>
    </header>
  )
}
