import { useMemo } from 'react'

import { MyStandingCard } from '@/components/player-dashboard/MyStandingCard'
import { PerformanceInsightCard } from '@/components/player-dashboard/PerformanceInsightCard'
import { PlayerGroupCard } from '@/components/player-dashboard/PlayerGroupCard'
import { PlayerProgressCard } from '@/components/player-dashboard/PlayerProgressCard'
import { PlayerQuickStats } from '@/components/player-dashboard/PlayerQuickStats'
import { PlayerWelcomeHero } from '@/components/player-dashboard/PlayerWelcomeHero'
import { SimMyResultsCard } from '@/components/player-dashboard/SimMyResultsCard'
import { UpcomingMatchesCard } from '@/components/player-dashboard/UpcomingMatchesCard'
import { GroupRankingCard } from '@/components/tournament-dashboard/GroupRankingCard'
import { ResultsMatrixCard } from '@/components/tournament-dashboard/ResultsMatrixCard'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DEMO_SIM_USER_EDGAR_ID,
  DEMO_SIM_USER_ZAIAH_ID,
} from '@/utils/tournamentSimulation'
import {
  getMiTorneoDemoStandingForUser,
  groupStandingToRankingRow,
  miTorneoDemoBundle,
  MI_TORNEO_DEMO_GROUP_ID,
  MI_TORNEO_DEMO_PLAYER3_ID,
  miTorneoSimPlayersToGroupPlayers,
} from '@/mock/miTorneoDemoBundle'
import { useAuthStore } from '@/stores/authStore'
import type { RankingRow } from '@/utils/ranking'

function firstNameFromProfile(name: string | null | undefined): string {
  const t = name?.trim()
  if (!t) return 'Jugador'
  return t.split(/\s+/)[0] ?? 'Jugador'
}

export function PlayerDashboardPage() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const profile = useAuthStore((s) => s.profile)

  const demo = miTorneoDemoBundle
  const group = demo.groups[0]!
  const players = demo.playersByGroupId[MI_TORNEO_DEMO_GROUP_ID] ?? []
  const matches = demo.matchesByGroupId[MI_TORNEO_DEMO_GROUP_ID] ?? []
  const standingsGs = demo.standingsByGroupId[MI_TORNEO_DEMO_GROUP_ID] ?? []

  const playersForUi = useMemo(() => {
    const name = profile?.full_name?.trim()
    if (userId === MI_TORNEO_DEMO_PLAYER3_ID && name) {
      return players.map((p) =>
        p.id === MI_TORNEO_DEMO_PLAYER3_ID ? { ...p, full_name: name } : p,
      )
    }
    return players
  }, [players, userId, profile?.full_name])

  const groupStandingForMatrix = useMemo(() => {
    const name = profile?.full_name?.trim()
    if (userId === MI_TORNEO_DEMO_PLAYER3_ID && name) {
      return standingsGs.map((r) =>
        r.playerId === MI_TORNEO_DEMO_PLAYER3_ID ? { ...r, displayName: name } : r,
      )
    }
    return standingsGs
  }, [standingsGs, userId, profile?.full_name])

  const myDemoPlayerId = useMemo(() => {
    if (!userId) return DEMO_SIM_USER_ZAIAH_ID
    if (
      userId === DEMO_SIM_USER_ZAIAH_ID ||
      userId === DEMO_SIM_USER_EDGAR_ID ||
      userId === MI_TORNEO_DEMO_PLAYER3_ID
    ) {
      return userId
    }
    return DEMO_SIM_USER_ZAIAH_ID
  }, [userId])

  const standingRow = useMemo(() => getMiTorneoDemoStandingForUser(userId), [userId])
  const standing: RankingRow | null = useMemo(() => {
    if (!standingRow) return null
    const base = groupStandingToRankingRow(standingRow)
    const name = profile?.full_name?.trim()
    if (
      userId === MI_TORNEO_DEMO_PLAYER3_ID &&
      name &&
      base.userId === MI_TORNEO_DEMO_PLAYER3_ID
    ) {
      return { ...base, displayName: name }
    }
    return base
  }, [standingRow, userId, profile?.full_name])

  const leader: RankingRow | null = useMemo(() => {
    const sorted = [...groupStandingForMatrix].sort((a, b) => a.position - b.position)
    const first = sorted[0]
    return first ? groupStandingToRankingRow(first) : null
  }, [groupStandingForMatrix])

  const groupPlayersUi = useMemo(
    () => miTorneoSimPlayersToGroupPlayers(playersForUi),
    [playersForUi],
  )

  const playedMatchesCount = matches.length
  const totalPerPlayer = players.length >= 2 ? players.length - 1 : 0
  const playedCount = standing?.played ?? 0

  const insightLines = useMemo(() => {
    if (!standing) return []
    const lines: string[] = [
      `Has sumado ${standing.points} puntos en el grupo (demo: +3 victoria, +1 derrota).`,
      `Round robin: ${totalPerPlayer} partidos por jugador; todos cerrados en esta demostración.`,
    ]
    return lines
  }, [standing, totalPerPlayer])

  if (!userId) {
    return (
      <div className="tdash-root min-h-[40vh] space-y-4 p-4">
        <Skeleton className="h-32 w-full max-w-3xl rounded-2xl" />
        <Skeleton className="h-24 w-full max-w-3xl rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="tdash-root min-h-screen bg-[var(--tdash-bg)]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <PlayerWelcomeHero
          firstName={firstNameFromProfile(profile?.full_name)}
          tournamentName={demo.tournamentName}
          groupName={group.name}
          tournamentStatus="active"
          subline="Vista de demostración: grupo de 5 jugadores con resultados fijos (misma lógica que la demo 90 jugadores)."
        />

        <PlayerQuickStats standing={standing} />
        <PlayerProgressCard played={playedCount} totalExpected={totalPerPlayer} />

        <section className="space-y-2" aria-label="Grupo completo">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--tdash-muted)]">
            Tu grupo · {group.name} · demostración
          </h2>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-8">
              <ResultsMatrixCard
                playerCount={playersForUi.length}
                matchCount={playedMatchesCount}
                players={playersForUi}
                matches={matches}
                standings={groupStandingForMatrix}
              />
            </div>
            <div className="min-w-0 xl:col-span-4">
              <div className="xl:sticky xl:top-6">
                <GroupRankingCard rows={groupStandingForMatrix} fullGroup />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-2" aria-label="Tu actividad">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--tdash-muted)]">
            Tu actividad (demo)
          </h2>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-8">
              <UpcomingMatchesCard
                groupName={group.name}
                matches={[]}
                playersById={new Map()}
                myGroupPlayerId={myDemoPlayerId}
                tournamentId="demo"
                groupId={group.id}
                allowScoreEntry={false}
              />
              <SimMyResultsCard
                myPlayerId={myDemoPlayerId}
                matches={matches}
                players={playersForUi}
              />
            </div>
            <div className="space-y-6 xl:col-span-4">
              <PlayerGroupCard
                groupName={group.name}
                players={groupPlayersUi}
                currentUserId={userId}
              />
              <MyStandingCard standing={standing} leader={leader} />
              <PerformanceInsightCard lines={insightLines} />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
