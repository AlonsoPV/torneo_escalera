import { Swords } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { PLY_COPY } from '@/lib/playerDashboardCopy'
import { getOpponentName } from '@/lib/playerDashboard'
import { tournamentGroupPathFromIdAndName } from '@/lib/tournamentUrl'
import { cn } from '@/lib/utils'
import type { GroupPlayer, MatchRow } from '@/types/database'

type Props = {
  match: MatchRow | null
  playersById: Map<string, GroupPlayer>
  myGroupPlayerId: string
  tournamentId: string
  tournamentName?: string
  groupId: string
  className?: string
}

export function NextOpponentHighlight(props: Props) {
  const { match, playersById, myGroupPlayerId, tournamentId, tournamentName, groupId, className } = props
  if (!match) return null
  const rival = getOpponentName(match, myGroupPlayerId, playersById)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--tdash-gold)]/40 bg-gradient-to-br from-[var(--tdash-top1-bg)] to-[var(--tdash-surface)] p-5 shadow-[var(--tdash-shadow-lg)]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--tdash-primary)] text-white shadow-md">
          <Swords className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--tdash-gold)]">
            {PLY_COPY.nextRival}
          </p>
          <p className="mt-0.5 text-xl font-bold text-[var(--tdash-text)]">{rival}</p>
          <p className="mt-1 text-sm text-[var(--tdash-muted)]">{PLY_COPY.scheduleTbd}</p>
          <Link
            to={tournamentGroupPathFromIdAndName(tournamentId, tournamentName, groupId)}
            className={cn(
              buttonVariants({ variant: 'default', size: 'sm' }),
              'mt-3 inline-flex w-full sm:w-auto',
            )}
          >
            Abrir partido
          </Link>
        </div>
      </div>
    </div>
  )
}
