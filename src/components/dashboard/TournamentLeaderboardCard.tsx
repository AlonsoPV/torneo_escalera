import { Trophy } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { TournamentLeaderboardEntry } from '@/services/dashboard/tournamentDashboardService'

import { LeaderboardList } from '@/components/dashboard/LeaderboardList'

export function TournamentLeaderboardCard({
  leaderboard,
  groupLabel,
}: {
  leaderboard: TournamentLeaderboardEntry[]
  groupLabel: string
}) {
  const isAll = groupLabel === 'general'

  return (
    <Card className="border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      <CardHeader className="space-y-0 px-4 pb-3 pt-4 sm:space-y-1 sm:px-6 sm:pb-4 sm:pt-5">
        <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-700 shadow-sm ring-1 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/25 min-[420px]:mt-0.5">
            <Trophy className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle className="text-base leading-snug sm:text-lg">Leaderboard</CardTitle>
            <CardDescription className="text-xs leading-relaxed sm:text-sm">
              Ranking oficial con resultados validados por administración.
              {isAll ? (
                <>
                  {' '}
                  <span className="font-medium text-foreground">Vista general del torneo.</span>
                </>
              ) : (
                <>
                  {' '}
                  <span className="font-medium text-foreground">Filtrado por grupo: {groupLabel}</span>
                </>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 px-3 pb-4 pt-0 sm:px-5 sm:pb-6">
        <LeaderboardList rows={leaderboard} />
      </CardContent>
    </Card>
  )
}
