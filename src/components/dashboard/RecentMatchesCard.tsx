import { History } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { TournamentRecentMatch } from '@/services/dashboard/tournamentDashboardService'

import { TournamentMatchStatusBadge } from '@/components/dashboard/TournamentMatchStatusBadge'
import { cn } from '@/lib/utils'

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

function formatScoreDisplay(label: string) {
  if (!label || label === '—') return '—'
  return label.replace(/, /g, ' · ')
}

export function RecentMatchesCard({
  matches,
  noMatchesScheduled,
}: {
  matches: TournamentRecentMatch[]
  /** True cuando no hay partidos en el alcance del torneo/filtro (métricas en 0). */
  noMatchesScheduled?: boolean
}) {
  const count = matches.length

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      <CardHeader className="space-y-1 border-b border-border/40 bg-gradient-to-br from-muted/[0.35] via-transparent to-transparent px-4 pb-4 pt-5 sm:px-6 sm:pb-4 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              <History className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base sm:text-lg">Resultados recientes</CardTitle>
              <CardDescription className="text-xs leading-relaxed sm:text-sm">
                Actividad más reciente según filtros de torneo, grupo y estado.
              </CardDescription>
            </div>
          </div>
          {count > 0 ? (
            <span
              className="shrink-0 rounded-full border border-border/60 bg-background/90 px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground shadow-sm"
              aria-label={`${count} resultados`}
            >
              {count}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:px-0">
        {count === 0 ? (
          <p className="mx-4 my-5 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-12 text-center text-sm leading-relaxed text-muted-foreground sm:mx-6">
            {noMatchesScheduled
              ? 'Aún no hay partidos registrados.'
              : 'No hay resultados con estos filtros. Prueba ampliar el grupo o el estado.'}
          </p>
        ) : (
          <ul
            className="divide-y divide-border/50"
            aria-label="Lista de resultados recientes"
          >
            {matches.map((m) => {
              const winA = m.winnerPlayer === 'a'
              const winB = m.winnerPlayer === 'b'
              const decided = winA || winB
              const scoreText = formatScoreDisplay(m.scoreLabel)

              return (
                <li key={m.id}>
                  <div
                    className={cn(
                      'relative px-4 py-3.5 transition-colors sm:px-6 sm:py-4',
                      'hover:bg-muted/[0.45]',
                      decided && 'border-l-[3px] border-l-emerald-500/80',
                      !decided && 'border-l-[3px] border-l-transparent',
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex w-full flex-shrink-0 flex-col gap-1.5 sm:min-w-[9rem] sm:max-w-[11rem]">
                        <div className="flex items-center justify-between gap-2 sm:block">
                          <span className="inline-flex max-w-[min(100%,14rem)] items-center rounded-lg bg-muted/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:max-w-none">
                            <span className="truncate">{m.groupName}</span>
                          </span>
                          <TournamentMatchStatusBadge status={m.status} className="shrink-0 sm:hidden" />
                        </div>
                        <time
                          dateTime={m.updatedAt}
                          className="text-[11px] font-medium tabular-nums text-muted-foreground sm:text-xs"
                        >
                          {shortDate(m.updatedAt)}
                        </time>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 w-full items-center gap-2 sm:gap-3">
                            <span
                              className={cn(
                                'min-w-0 flex-1 truncate text-right text-sm font-medium sm:text-base',
                                winA && 'font-semibold text-emerald-700 dark:text-emerald-400',
                                winB && 'text-muted-foreground',
                                !decided && 'text-foreground',
                              )}
                            >
                              {m.playerAName}
                            </span>
                            <span
                              className="shrink-0 rounded-xl border border-border/70 bg-gradient-to-b from-background to-muted/30 px-3 py-1.5 text-center font-mono text-sm font-bold tabular-nums tracking-tight text-foreground shadow-sm sm:min-w-[5.5rem] sm:px-3.5 sm:text-base"
                              aria-label={`Marcador ${scoreText}`}
                            >
                              {scoreText}
                            </span>
                            <span
                              className={cn(
                                'min-w-0 flex-1 truncate text-left text-sm font-medium sm:text-base',
                                winB && 'font-semibold text-emerald-700 dark:text-emerald-400',
                                winA && 'text-muted-foreground',
                                !decided && 'text-foreground',
                              )}
                            >
                              {m.playerBName}
                            </span>
                          </div>
                        {m.pointsNote ? (
                          <p className="mt-2 text-center text-[11px] text-muted-foreground sm:mt-1.5 sm:text-left">
                            Puntos (ganador / perdedor): <span className="font-medium text-foreground/90">{m.pointsNote}</span>
                          </p>
                        ) : null}
                      </div>

                      <div className="hidden shrink-0 sm:flex sm:items-center sm:justify-end sm:pt-0.5">
                        <TournamentMatchStatusBadge status={m.status} className="whitespace-nowrap" />
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
