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
        'overflow-hidden rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)] transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(15,23,42,0.09)]',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] to-[var(--tdash-surface-2)] px-5 py-5 md:px-6 md:py-6">
        <h2 className="text-xl font-bold tracking-tight text-[var(--tdash-text)] md:text-[1.35rem]">
          {TDASH_COPY.matrixTitle}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--tdash-muted)]">
          {TDASH_COPY.matrixSubtitle}
        </p>
      </div>
      <MatrixToolbar playerCount={playerCount} matchCount={matchCount} />
      <div className="p-3 sm:p-4 md:p-5">
        <ResultsMatrixTable players={players} matches={matches} standings={standings} />
      </div>
    </section>
  )
}
