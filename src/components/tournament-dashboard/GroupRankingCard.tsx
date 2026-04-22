import { RankingList } from '@/components/tournament-dashboard/RankingList'
import { TDASH_COPY } from '@/lib/tournamentDashboardCopy'
import { cn } from '@/lib/utils'
import type { GroupStandingRow } from '@/types/tournament'

type Props = {
  rows: GroupStandingRow[]
  /** Ranking completo del grupo (Mi torneo); por defecto top 5 (demo). */
  fullGroup?: boolean
  className?: string
}

export function GroupRankingCard(props: Props) {
  const { rows, fullGroup, className } = props

  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)] transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(15,23,42,0.09)] sm:rounded-2xl',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] to-[var(--tdash-surface-2)] px-4 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6">
        <h2 className="text-lg font-bold tracking-tight text-[var(--tdash-text)] sm:text-xl md:text-[1.35rem]">
          {TDASH_COPY.rankingTitle}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--tdash-muted)] sm:mt-1.5 sm:text-sm">
          {TDASH_COPY.rankingSubtitle}
        </p>
      </div>
      <div className="p-3 sm:p-5 md:p-6">
        <RankingList rows={rows} fullGroup={fullGroup} />
      </div>
    </section>
  )
}
