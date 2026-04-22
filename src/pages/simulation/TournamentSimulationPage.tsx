import { useState } from 'react'

import { TournamentDashboardPage } from '@/components/tournament-dashboard/TournamentDashboardPage'
import { tournamentSimulationDemo } from '@/mock/tournamentSimulation'
import { GROUPS, MATCHES_PER_GROUP, PLAYERS_TOTAL } from '@/utils/tournamentSimulation'

export function TournamentSimulationPage() {
  const bundle = tournamentSimulationDemo
  const [groupId, setGroupId] = useState(bundle.groups[0]?.id ?? '')

  const totalMatches = GROUPS * MATCHES_PER_GROUP

  return (
    <TournamentDashboardPage
      bundle={bundle}
      groupId={groupId}
      onGroupChange={setGroupId}
      totalPlayers={PLAYERS_TOTAL}
      totalGroups={GROUPS}
      totalMatches={totalMatches}
      heroTitle={bundle.tournamentName}
      heroMeta={`Torneo por grupos · ${PLAYERS_TOTAL} jugadores · Formato round robin`}
      statusLabel="En curso"
    />
  )
}
