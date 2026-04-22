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
        'overflow-hidden rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)] sm:rounded-2xl',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] to-[var(--tdash-surface-2)] px-4 py-3 sm:px-5 sm:py-4">
        <h2 className="text-base font-bold text-[var(--tdash-text)] sm:text-lg">{PLY_COPY.upcomingTitle}</h2>
        <p className="mt-0.5 text-xs text-[var(--tdash-muted)] sm:text-sm">{PLY_COPY.upcomingSub}</p>
      </div>
      <div className="p-2 sm:p-4">
        {matches.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-3 py-8 text-center sm:rounded-xl sm:px-4 sm:py-10">
            <p className="text-xs font-medium text-[var(--tdash-text)] sm:text-sm">{PLY_COPY.allGroupDone}</p>
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
      <div className="flex items-start gap-2 border-t border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/50 px-3 py-2 text-[11px] leading-snug text-[var(--tdash-muted)] sm:items-center sm:px-4 sm:py-2.5 sm:text-xs">
        <CalendarClock className="mt-0.5 size-3.5 shrink-0 sm:mt-0" aria-hidden />
        <span>Las fechas y canchas se acuerdan con la organización o en el club.</span>
      </div>
    </section>
  )
}
