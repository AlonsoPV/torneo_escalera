import { getCellLabelAndTitle } from '@/components/simulation/matrixLabels'
import { DashboardStatusBadge } from '@/components/tournament-dashboard/DashboardStatusBadge'
import { PLY_COPY } from '@/lib/playerDashboardCopy'
import { cn } from '@/lib/utils'
import type { SimMatch, SimPlayer } from '@/types/tournament'

type Props = {
  myPlayerId: string
  matches: SimMatch[]
  players: SimPlayer[]
  className?: string
}

function opponentName(match: SimMatch, myId: string, byId: Map<string, SimPlayer>): string {
  const oid = match.playerAId === myId ? match.playerBId : match.playerAId
  return byId.get(oid)?.full_name ?? '—'
}

export function SimMyResultsCard(props: Props) {
  const { myPlayerId, matches, players, className } = props
  const byId = new Map(players.map((p) => [p.id, p]))
  const mine = matches.filter((m) => m.playerAId === myPlayerId || m.playerBId === myPlayerId)

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)]',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] to-[var(--tdash-surface-2)] px-5 py-4">
        <h2 className="text-lg font-bold text-[var(--tdash-text)]">{PLY_COPY.resultsTitle}</h2>
        <p className="text-sm text-[var(--tdash-muted)]">Demo · {PLY_COPY.resultsSub}</p>
      </div>
      <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-3 sm:p-4 [scrollbar-width:thin]">
        {mine.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--tdash-muted)]">{PLY_COPY.noResults}</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((m) => {
              const rival = opponentName(m, myPlayerId, byId)
              const { label, title } = getCellLabelAndTitle(myPlayerId, m)
              const won = m.winnerId === myPlayerId
              const pts = won ? 3 : 1

              return (
                <li
                  key={m.id}
                  className="rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/50 p-3"
                >
                  <p className="font-semibold text-[var(--tdash-text)]">Vs. {rival}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <DashboardStatusBadge variant={won ? 'win' : 'loss'}>
                      {won ? PLY_COPY.win : PLY_COPY.loss}
                    </DashboardStatusBadge>
                    <span
                      className="font-mono text-sm font-medium tabular-nums text-[var(--tdash-text)]"
                      title={title}
                    >
                      {label}
                    </span>
                    <span className="text-sm font-bold text-[var(--tdash-primary)]">+{pts} pts</span>
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
