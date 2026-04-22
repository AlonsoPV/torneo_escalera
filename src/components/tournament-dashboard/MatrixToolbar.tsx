import { DashboardStatusBadge } from '@/components/tournament-dashboard/DashboardStatusBadge'

type Props = {
  playerCount: number
  matchCount: number
}

export function MatrixToolbar(props: Props) {
  const { playerCount, matchCount } = props

  return (
    <div className="flex flex-col gap-2.5 border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--tdash-muted)] sm:text-sm">
        <span className="font-medium text-[var(--tdash-text)]">{playerCount}</span>
        <span>jugadores</span>
        <span className="text-[var(--tdash-border)]">·</span>
        <span className="font-medium text-[var(--tdash-text)]">{matchCount}</span>
        <span>partidos</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
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
