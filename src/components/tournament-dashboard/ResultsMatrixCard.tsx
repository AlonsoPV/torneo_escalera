import { MatrixToolbar } from '@/components/tournament-dashboard/MatrixToolbar'
import { ResultsMatrixTable } from '@/components/tournament-dashboard/ResultsMatrixTable'
import { TDASH_COPY } from '@/lib/tournamentDashboardCopy'
import { cn } from '@/lib/utils'
import type { GroupStandingRow, SimMatch, SimPlayer } from '@/types/tournament'

type Props = {
  playerCount: number
  matchCount: number
  players: SimPlayer[]
  matches: SimMatch[]
  standings: GroupStandingRow[]
  className?: string
}

export function ResultsMatrixCard(props: Props) {
  const { playerCount, matchCount, players, matches, standings, className } = props

  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)] transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(15,23,42,0.09)]',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] bg-[var(--tdash-surface)] px-4 py-4 sm:px-5 md:px-6">
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--tdash-text)] sm:text-xl">
              {TDASH_COPY.matrixTitle}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--tdash-muted)] sm:text-sm">
              {TDASH_COPY.matrixSubtitle}
            </p>
          </div>
          <p className="hidden text-xs font-medium uppercase tracking-wide text-[var(--tdash-muted)] lg:block">
            Desliza horizontalmente para ver todo el grupo
          </p>
        </div>
      </div>
      <MatrixToolbar playerCount={playerCount} matchCount={matchCount} />
      <div className="bg-[var(--tdash-surface-2)]/35 p-2 sm:p-3 md:p-4">
        <ResultsMatrixTable players={players} matches={matches} standings={standings} />
      </div>
    </section>
  )
}
