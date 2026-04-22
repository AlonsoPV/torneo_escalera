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
        'rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)] transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(15,23,42,0.09)]',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] to-[var(--tdash-surface-2)] px-5 py-5 md:px-6 md:py-6">
        <h2 className="text-xl font-bold tracking-tight text-[var(--tdash-text)] md:text-[1.35rem]">
          {TDASH_COPY.rankingTitle}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--tdash-muted)]">{TDASH_COPY.rankingSubtitle}</p>
      </div>
      <div className="p-4 sm:p-5 md:p-6">
        <RankingList rows={rows} fullGroup={fullGroup} />
      </div>
    </section>
  )
}
