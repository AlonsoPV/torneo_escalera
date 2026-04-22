import { CalendarClock, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { PLY_COPY } from '@/lib/playerDashboardCopy'
import {
  getOpponentName,
} from '@/lib/playerDashboard'
import { cn } from '@/lib/utils'
import type { GroupPlayer, MatchRow } from '@/types/database'

type Props = {
  groupName: string
  matches: MatchRow[]
  playersById: Map<string, GroupPlayer>
  myGroupPlayerId: string
  tournamentId: string
  groupId: string
  allowScoreEntry: boolean
  className?: string
}

export function UpcomingMatchesCard(props: Props) {
  const {
    groupName,
    matches,
    playersById,
    myGroupPlayerId,
    tournamentId,
    groupId,
    allowScoreEntry,
    className,
  } = props

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)]',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] to-[var(--tdash-surface-2)] px-5 py-4">
        <h2 className="text-lg font-bold text-[var(--tdash-text)]">{PLY_COPY.upcomingTitle}</h2>
        <p className="text-sm text-[var(--tdash-muted)]">{PLY_COPY.upcomingSub}</p>
      </div>
      <div className="p-3 sm:p-4">
        {matches.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-4 py-10 text-center">
            <p className="text-sm font-medium text-[var(--tdash-text)]">{PLY_COPY.allGroupDone}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => {
              const rival = getOpponentName(m, myGroupPlayerId, playersById)
              return (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/60 p-3 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--tdash-text)]">Vs. {rival}</p>
                    <p className="text-xs text-[var(--tdash-muted)]">
                      {groupName} · {PLY_COPY.scheduleTbd}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {allowScoreEntry ? (
                      <Link
                        to={`/tournaments/${tournamentId}?group=${groupId}`}
                        className={buttonVariants({ variant: 'default', size: 'sm' })}
                      >
                        Ver / registrar
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    ) : (
                      <Link
                        to={`/tournaments/${tournamentId}?group=${groupId}`}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        Ver detalle
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/50 px-4 py-2.5 text-xs text-[var(--tdash-muted)]">
        <CalendarClock className="size-3.5 shrink-0" aria-hidden />
        <span>Las fechas y canchas se acuerdan con la organización o en el club.</span>
      </div>
    </section>
  )
}
