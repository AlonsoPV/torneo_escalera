import { DashboardStatusBadge } from '@/components/tournament-dashboard/DashboardStatusBadge'

type Props = {
  playerCount: number
  matchCount: number
}

export function MatrixToolbar(props: Props) {
  const { playerCount, matchCount } = props

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/60 px-3 py-3 sm:px-5 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="rounded-lg border border-[var(--tdash-border)] bg-[var(--tdash-surface)] px-3 py-2">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--tdash-muted)]">
            Jugadores
          </span>
          <span className="font-mono text-sm font-bold tabular-nums text-[var(--tdash-text)]">
            {playerCount}
          </span>
        </div>
        <div className="rounded-lg border border-[var(--tdash-border)] bg-[var(--tdash-surface)] px-3 py-2">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--tdash-muted)]">
            Partidos
          </span>
          <span className="font-mono text-sm font-bold tabular-nums text-[var(--tdash-text)]">
            {matchCount}
          </span>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--tdash-muted)]">
          Leyenda
        </span>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <DashboardStatusBadge variant="win" className="px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs">
            Victoria
          </DashboardStatusBadge>
          <DashboardStatusBadge variant="loss" className="px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs">
            Derrota
          </DashboardStatusBadge>
          <DashboardStatusBadge variant="default" className="px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs">
            Default
          </DashboardStatusBadge>
        </div>
      </div>
    </div>
  )
}
