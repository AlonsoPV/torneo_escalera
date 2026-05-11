import type { TournamentLeaderboardEntry } from '@/services/dashboard/tournamentDashboardService'

import { LeaderboardList } from '@/components/dashboard/LeaderboardList'

export function LeaderboardTable({ rows }: { rows: TournamentLeaderboardEntry[] }) {
  return <LeaderboardList rows={rows} />
}
