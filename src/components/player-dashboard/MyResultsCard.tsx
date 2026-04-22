import { PLY_COPY } from '@/lib/playerDashboardCopy'
import {
  getMatchOutcome,
  getOpponentName,
  getPlayerPerspectiveScoreLabel,
  getPointsForPlayerInMatch,
  shortDateTimeLabel,
} from '@/lib/playerDashboard'
import { cn } from '@/lib/utils'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'

import { DashboardStatusBadge } from '@/components/tournament-dashboard/DashboardStatusBadge'

type Props = {
  matches: MatchRow[]
  playersById: Map<string, GroupPlayer>
  myGroupPlayerId: string
  rules: Pick<TournamentRules, 'points_per_win' | 'points_per_loss'>
  className?: string
}

function outcomeLabel(o: 'win' | 'loss' | null): { text: string; variant: 'win' | 'loss' } {
  if (o === 'win') return { text: PLY_COPY.win, variant: 'win' }
  if (o === 'loss') return { text: PLY_COPY.loss, variant: 'loss' }
  return { text: '—', variant: 'loss' }
}

export function MyResultsCard(props: Props) {
  const { matches, playersById, myGroupPlayerId, rules, className } = props

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)]',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] to-[var(--tdash-surface-2)] px-5 py-4">
        <h2 className="text-lg font-bold text-[var(--tdash-text)]">{PLY_COPY.resultsTitle}</h2>
        <p className="text-sm text-[var(--tdash-muted)]">{PLY_COPY.resultsSub}</p>
      </div>
      <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-3 sm:p-4 [scrollbar-width:thin]">
        {matches.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-4 py-10 text-center">
            <p className="text-sm font-medium text-[var(--tdash-text)]">{PLY_COPY.noResults}</p>
            <p className="mt-1 text-sm text-[var(--tdash-muted)]">
              Cuando juegues, aquí verás el marcador como lo viviste.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => {
              const rival = getOpponentName(m, myGroupPlayerId, playersById)
              const score = getPlayerPerspectiveScoreLabel(m, myGroupPlayerId)
              const o = getMatchOutcome(m, myGroupPlayerId)
              const { text: otext, variant } = outcomeLabel(o)
              const pts = getPointsForPlayerInMatch(m, myGroupPlayerId, rules)
              const when = shortDateTimeLabel(m.updated_at)

              return (
                <li
                  key={m.id}
                  className="rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/50 p-3 transition-colors hover:bg-[var(--tdash-surface-2)]"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--tdash-text)]">Vs. {rival}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <DashboardStatusBadge variant={variant}>{otext}</DashboardStatusBadge>
                        <span className="font-mono text-sm font-medium tabular-nums text-[var(--tdash-text)]">
                          {score}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right sm:pt-0.5">
                      <p className="text-sm font-bold text-[var(--tdash-primary)]">+{pts} pts</p>
                      {when ? (
                        <p className="text-[11px] text-[var(--tdash-muted)]">
                          {when.line1} · {when.line2}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
