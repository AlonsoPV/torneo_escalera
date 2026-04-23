import { getCellLabelAndTitle } from '@/components/simulation/matrixLabels'
import { DashboardStatusBadge } from '@/components/tournament-dashboard/DashboardStatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { PLY_COPY } from '@/lib/playerDashboardCopy'
import { cn } from '@/lib/utils'
import { LayoutGrid } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { SimMatch, SimPlayer } from '@/types/tournament'

type Props = {
  myPlayerId: string
  matches: SimMatch[]
  players: SimPlayer[]
  className?: string
  /** Por defecto "Demo" */
  listSubtitle?: string
  /** Puntos a mostrar (p.ej. reglas reales). Por defecto +3 / +1 como la demo. */
  getPointsText?: (m: SimMatch, won: boolean) => string
  /** Si existe, enlace a la matriz del torneo para capturar o corregir marcador. */
  matrixHref?: string
}

function opponentName(match: SimMatch, myId: string, byId: Map<string, SimPlayer>): string {
  const oid = match.playerAId === myId ? match.playerBId : match.playerAId
  return byId.get(oid)?.full_name ?? '—'
}

export function SimMyResultsCard(props: Props) {
  const { myPlayerId, matches, players, className, listSubtitle = 'Demo', getPointsText, matrixHref } =
    props
  const byId = new Map(players.map((p) => [p.id, p]))
  const mine = matches.filter((m) => m.playerAId === myPlayerId || m.playerBId === myPlayerId)

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)] sm:rounded-2xl',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] to-[var(--tdash-surface-2)] px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--tdash-text)] sm:text-lg">{PLY_COPY.resultsTitle}</h2>
            <p className="mt-0.5 text-xs text-[var(--tdash-muted)] sm:text-sm">
              {listSubtitle} · {PLY_COPY.resultsSub}
            </p>
          </div>
          {matrixHref ? (
            <Link
              to={matrixHref}
              className={buttonVariants({
                variant: 'default',
                size: 'sm',
                className: 'h-9 w-full shrink-0 gap-1.5 sm:w-auto',
              })}
            >
              <LayoutGrid className="size-3.5" aria-hidden />
              {PLY_COPY.resultsCtaMatrix}
            </Link>
          ) : null}
        </div>
      </div>
      <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-2 sm:p-4 [scrollbar-width:thin]">
        {mine.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--tdash-muted)]">{PLY_COPY.noResults}</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((m) => {
              const rival = opponentName(m, myPlayerId, byId)
              const { label, title } = getCellLabelAndTitle(myPlayerId, m)
              const pending = m.winnerId == null
              const won = !pending && m.winnerId === myPlayerId
              const pts = pending
                ? null
                : getPointsText
                  ? getPointsText(m, won)
                  : won
                    ? `+3 pts`
                    : `+1 pt`

              return (
                <li
                  key={m.id}
                  className="rounded-lg border border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/50 p-2.5 sm:rounded-xl sm:p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--tdash-text)] sm:text-base">Vs. {rival}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {pending ? (
                          <DashboardStatusBadge variant="neutral">Por jugar</DashboardStatusBadge>
                        ) : (
                          <DashboardStatusBadge variant={won ? 'win' : 'loss'}>
                            {won ? PLY_COPY.win : PLY_COPY.loss}
                          </DashboardStatusBadge>
                        )}
                        <span
                          className="font-mono text-sm font-medium tabular-nums text-[var(--tdash-text)]"
                          title={title}
                        >
                          {label}
                        </span>
                        {pts != null ? (
                          <span className="text-sm font-bold text-[var(--tdash-primary)]">{pts}</span>
                        ) : null}
                      </div>
                    </div>
                    {pending && matrixHref ? (
                      <Link
                        to={matrixHref}
                        className={buttonVariants({
                          variant: 'secondary',
                          size: 'sm',
                          className: 'h-8 w-full shrink-0 sm:w-auto',
                        })}
                      >
                        {PLY_COPY.resultsRowCtaMark}
                      </Link>
                    ) : null}
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
