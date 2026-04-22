import { DashboardStatusBadge } from '@/components/tournament-dashboard/DashboardStatusBadge'

type Props = {
  playerCount: number
  matchCount: number
}

export function MatrixToolbar(props: Props) {
  const { playerCount, matchCount } = props

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--tdash-muted)]">
        <span className="font-medium text-[var(--tdash-text)]">{playerCount}</span>
        <span>jugadores</span>
        <span className="text-[var(--tdash-border)]">·</span>
        <span className="font-medium text-[var(--tdash-text)]">{matchCount}</span>
        <span>partidos</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--tdash-muted)]">
          Leyenda
        </span>
        <DashboardStatusBadge variant="win">Victoria</DashboardStatusBadge>
        <DashboardStatusBadge variant="loss">Derrota</DashboardStatusBadge>
        <DashboardStatusBadge variant="default">Default</DashboardStatusBadge>
      </div>
    </div>
  )
}
