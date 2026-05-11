import { Card, CardContent } from '@/components/ui/card'
import type { Tournament, TournamentStatus } from '@/types/database'

const statusLabel: Record<TournamentStatus, string> = {
  draft: 'Borrador',
  active: 'En curso',
  finished: 'Finalizado',
  archived: 'Archivado',
}

const statusPillClass: Record<TournamentStatus, string> = {
  active: 'border-emerald-200/90 bg-emerald-100 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300',
  draft: 'border-amber-200/90 bg-amber-100 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200',
  finished: 'border-border bg-muted text-muted-foreground',
  archived: 'border-border bg-muted text-muted-foreground',
}

export function TournamentDashboardHeaderCompact({
  tournament,
}: {
  tournament: Tournament
}) {
  const categoryOrSeason = [tournament.category, tournament.season].filter(Boolean).join(' · ') || null

  return (
    <Card className="border-border/80 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
              Dashboard del torneo
            </p>
            <h1 className="text-balance text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {tournament.name}
            </h1>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              Ranking, avance y desempeño por grupo
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:shrink-0">
            {categoryOrSeason ? (
              <span className="max-w-[12rem] truncate text-sm text-muted-foreground sm:max-w-none" title={categoryOrSeason}>
                {categoryOrSeason}
              </span>
            ) : null}
            <span
              className={`rounded-full border px-3 py-1 text-center text-xs font-medium ${statusPillClass[tournament.status]}`}
            >
              {statusLabel[tournament.status]}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
