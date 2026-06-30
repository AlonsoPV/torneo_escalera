import { DashboardStatusBadge } from '@/components/tournament-dashboard/DashboardStatusBadge'

type Props = {
  playerCount: number
  matchCount: number
}

function MatrixStatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-[var(--tdash-border)] bg-[var(--tdash-surface)] px-2 py-1 sm:gap-2 sm:rounded-lg sm:px-3 sm:py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--tdash-muted)]">
        {label}
      </span>
      <span className="font-mono text-sm font-bold tabular-nums leading-none text-[var(--tdash-text)]">
        {value}
      </span>
    </div>
  )
}

export function MatrixToolbar(props: Props) {
  const { playerCount, matchCount } = props

  return (
    <div className="border-b border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/60 px-3 py-2 sm:px-5 sm:py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <MatrixStatPill label="Jugadores" value={playerCount} />
          <MatrixStatPill label="Partidos" value={matchCount} />
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:justify-end">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--tdash-muted)]">
            Leyenda
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-none sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
            <DashboardStatusBadge
              variant="win"
              className="shrink-0 px-1.5 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs"
            >
              Victoria
            </DashboardStatusBadge>
            <DashboardStatusBadge
              variant="loss"
              className="shrink-0 px-1.5 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs"
            >
              Derrota
            </DashboardStatusBadge>
            <DashboardStatusBadge
              variant="default"
              className="shrink-0 px-1.5 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-xs"
            >
              Default
            </DashboardStatusBadge>
          </div>
        </div>
      </div>
    </div>
  )
}
