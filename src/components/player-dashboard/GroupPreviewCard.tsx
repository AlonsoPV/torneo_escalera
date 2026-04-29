import { Link } from 'react-router-dom'
import { ChevronRight, Trophy } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { PLY_COPY } from '@/lib/playerDashboardCopy'
import { tournamentGroupPathFromIdAndName } from '@/lib/tournamentUrl'
import { cn } from '@/lib/utils'
import type { RankingRow } from '@/utils/ranking'

type Props = {
  rows: RankingRow[]
  currentUserId: string
  tournamentId: string
  tournamentName?: string
  groupId: string
  className?: string
}

function rowBg(position: number) {
  if (position === 1) return 'bg-[var(--tdash-top1-bg)]/90'
  if (position === 2) return 'bg-[var(--tdash-top2-bg)]/80'
  if (position === 3) return 'bg-[var(--tdash-top3-bg)]/80'
  return 'bg-transparent'
}

export function GroupPreviewCard(props: Props) {
  const { rows, currentUserId, tournamentId, tournamentName, groupId, className } = props
  const ordered = [...rows].sort((a, b) => a.position - b.position)

  return (
    <section
      className={cn(
        'rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow)]',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-[var(--tdash-text)]">
          <Trophy className="size-4 text-[var(--tdash-gold)]" aria-hidden />
          {PLY_COPY.groupPreviewTitle}
        </h2>
        <p className="text-xs text-[var(--tdash-muted)]">{PLY_COPY.groupPreviewSub}</p>
      </div>
      {ordered.length === 0 ? (
        <p className="p-4 text-sm text-[var(--tdash-muted)]">—</p>
      ) : (
        <ul className="divide-y divide-[var(--tdash-border)] p-2">
          {ordered.map((r) => {
            const isYou = r.userId === currentUserId
            return (
              <li
                key={r.groupPlayerId}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  rowBg(r.position),
                  isYou && 'font-semibold ring-1 ring-inset ring-[var(--tdash-primary)]/20',
                )}
              >
                <span className="w-6 shrink-0 text-center font-mono text-xs text-[var(--tdash-muted)]">
                  {r.position}
                </span>
                <span className="min-w-0 flex-1 truncate text-[var(--tdash-text)]">
                  {isYou ? 'Tú — ' : null}
                  {r.displayName}
                </span>
                <span className="shrink-0 font-mono font-bold tabular-nums text-[var(--tdash-primary)]">
                  {r.points}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="border-t border-[var(--tdash-border)] p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to={tournamentGroupPathFromIdAndName(tournamentId, tournamentName, groupId)}
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'w-full justify-center sm:flex-1')}
          >
            {PLY_COPY.ctaFullGroup}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--tdash-muted)]">
          {PLY_COPY.ctaMatrix} · {PLY_COPY.ctaRanking}
        </p>
      </div>
    </section>
  )
}
