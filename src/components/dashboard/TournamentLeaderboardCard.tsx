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
      <CardHeader className="space-y-1 px-4 pb-2 pt-0 sm:px-6 sm:pb-3">
        <CardTitle className="text-base sm:text-lg">Leaderboard</CardTitle>
        <CardDescription className="text-xs leading-relaxed sm:text-sm">
          El ranking oficial solo considera resultados validados por administración.
          {isAll ? (
            <>
              {' '}
              <span className="font-medium text-foreground">Vista general.</span>
            </>
          ) : (
            <>
              {' '}
              <span className="font-medium text-foreground">Grupo · {groupLabel}</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-4 pt-0 sm:px-4 sm:pb-5">
        <LeaderboardList rows={leaderboard} />
      </CardContent>
    </Card>
  )
}
