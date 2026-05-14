import { LeaderboardList } from '@/components/dashboard/LeaderboardList'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { TournamentLeaderboardEntry } from '@/services/dashboard/tournamentDashboardService'
import type { RankingRow } from '@/utils/ranking'

type Props = {
  groupId: string
  groupName: string
  ranking: RankingRow[]
  currentUserId: string | null
  className?: string
}

function rowsForLeaderboard(
  ranking: RankingRow[],
  groupId: string,
  groupName: string,
): TournamentLeaderboardEntry[] {
  return ranking.map((r) => ({ ...r, groupId, groupName }))
}

export function PlayerGroupSection({
  groupId,
  groupName,
  ranking,
  currentUserId,
  className,
}: Props) {
  const rows = rowsForLeaderboard(ranking, groupId, groupName)

  return (
    <section id="player-section-group" data-name="player-section-group" className={cn(className)}>
      <Card className="border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
        <CardHeader className="space-y-1 px-4 pb-2 pt-0 sm:px-6 sm:pb-3">
          <CardTitle className="text-base sm:text-lg">Leaderboard</CardTitle>
          <CardDescription className="text-xs leading-relaxed sm:text-sm">
            El ranking oficial solo considera resultados validados por administración.{' '}
            <span className="font-medium text-foreground">Grupo · {groupName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 pb-4 pt-0 sm:px-4 sm:pb-5">
          <LeaderboardList rows={rows} highlightUserId={currentUserId} />
        </CardContent>
      </Card>
    </section>
  )
}
