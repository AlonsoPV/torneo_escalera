import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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
  getPlayerStanding,
  getUpcomingMatches,
  roundRobinMatchesPerPlayer,
} from '@/lib/playerDashboard'
import {
  groupPlayersToSimPlayers,
  matchRowsToSimMatches,
  rankingRowsToGroupStandings,
} from '@/lib/realTournamentView'
import { getPlayerDashboardData } from '@/services/dashboardPlayer'
import { useAuthStore } from '@/stores/authStore'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'
import type { SimMatch } from '@/types/tournament'
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
import type { RankingRow } from '@/utils/ranking'

const showEmbeddedDemo = import.meta.env.VITE_DEMO_MODE === 'true'

function firstNameFromProfile(name: string | null | undefined): string {
  const t = name?.trim()
  if (!t) return 'Jugador'
  return t.split(/\s+/)[0] ?? 'Jugador'
}

function buildPointsText(rules: TournamentRules) {
  return (m: SimMatch, won: boolean) => {
    if (m.resultType === 'default') {
      const defWin = String(rules.points_default_win)
      const defLoss = String(rules.points_default_loss)
      return `+${won ? defWin : defLoss} pts (W/O)`
    }
    if (won) return `+${rules.points_per_win} pts`
    return `+${rules.points_per_loss} pts`
  }
}

export function PlayerDashboardPage() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const profile = useAuthStore((s) => s.profile)

  const liveQ = useQuery({
    queryKey: ['playerDashboard', userId],
    queryFn: () => (userId ? getPlayerDashboardData(userId) : null),
    enabled: Boolean(userId),
  })

  const demo = miTorneoDemoBundle
  const dGroup = demo.groups[0]!
  const dPlayers = demo.playersByGroupId[MI_TORNEO_DEMO_GROUP_ID] ?? []
  const dMatches = demo.matchesByGroupId[MI_TORNEO_DEMO_GROUP_ID] ?? []
  const dStandings = demo.standingsByGroupId[MI_TORNEO_DEMO_GROUP_ID] ?? []

  const playersForUi = useMemo(() => {
    const name = profile?.full_name?.trim()
    if (userId === MI_TORNEO_DEMO_PLAYER3_ID && name) {
      return dPlayers.map((p) =>
        p.id === MI_TORNEO_DEMO_PLAYER3_ID ? { ...p, full_name: name } : p,
      )
    }
    return dPlayers
  }, [dPlayers, userId, profile?.full_name])

  const groupStandingForMatrix = useMemo(() => {
    const name = profile?.full_name?.trim()
    if (userId === MI_TORNEO_DEMO_PLAYER3_ID && name) {
      return dStandings.map((r) =>
        r.playerId === MI_TORNEO_DEMO_PLAYER3_ID ? { ...r, displayName: name } : r,
      )
    }
    return dStandings
  }, [dStandings, userId, profile?.full_name])

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
  const standingDemo: RankingRow | null = useMemo(() => {
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

  const leaderDemo: RankingRow | null = useMemo(() => {
    const sorted = [...groupStandingForMatrix].sort((a, b) => a.position - b.position)
    const first = sorted[0]
    return first ? groupStandingToRankingRow(first) : null
  }, [groupStandingForMatrix])

  const groupPlayersUi = useMemo(
    () => miTorneoSimPlayersToGroupPlayers(playersForUi),
    [playersForUi],
  )

  const totalPerPlayer = dPlayers.length >= 2 ? dPlayers.length - 1 : 0
  const playedCountDemo = standingDemo?.played ?? 0

  const insightLinesDemo = useMemo(() => {
    if (!standingDemo) return []
    return [
      `Has sumado ${standingDemo.points} puntos en el grupo (demo: +3 victoria, +1 derrota).`,
      `Round robin: ${totalPerPlayer} partidos por jugador; todos cerrados en esta demostración.`,
    ]
  }, [standingDemo, totalPerPlayer])

  if (!userId) {
    return (
      <div className="tdash-root min-h-[40vh] space-y-3 px-0 py-4 sm:space-y-4">
        <Skeleton className="h-28 w-full max-w-3xl rounded-xl sm:h-32 sm:rounded-2xl" />
        <Skeleton className="h-20 w-full max-w-3xl rounded-xl sm:h-24 sm:rounded-2xl" />
      </div>
    )
  }

  if (liveQ.isLoading) {
    return (
      <div className="tdash-root min-h-screen bg-[var(--tdash-bg)] px-0 py-4 sm:py-5">
        <div className="mx-auto w-full max-w-7xl space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  const data = liveQ.data

  if (data) {
    const gId = data.group.id
    const simPlayers = groupPlayersToSimPlayers(data.players, gId)
    const simMatches = matchRowsToSimMatches(data.matches, gId)
    const tableStand = rankingRowsToGroupStandings(data.players, data.ranking)
    const meRow = getPlayerStanding(userId, data.ranking) ?? null
    const leaderRow = data.ranking[0] ?? null
    const myGp = data.membership
    const playersById = new Map((data.players as GroupPlayer[]).map((p) => [p.id, p] as const))
    const upcoming = getUpcomingMatches(myGp.id, data.matches as MatchRow[])
    const rr = roundRobinMatchesPerPlayer(data.players.length)
    const insightLinesLive = meRow
      ? [
          `Llevas ${meRow.points} puntos (reglas: +${data.rules.points_per_win} / ${data.rules.points_per_loss} por partido normal).`,
        ]
      : ['Sin datos de ranking todavía.']

    return (
      <div className="tdash-root min-h-screen bg-[var(--tdash-bg)]">
        <div className="mx-auto w-full max-w-7xl space-y-4 px-0 py-4 sm:space-y-5 sm:py-5 md:space-y-6 md:py-8">
          <PlayerWelcomeHero
            firstName={firstNameFromProfile(profile?.full_name)}
            tournamentName={data.tournament.name}
            groupName={data.group.name}
            tournamentStatus={data.tournament.status}
            subline="Vista conectada a tu torneo y grupo reales (Supabase)."
          />

          <PlayerQuickStats standing={meRow} />
          <PlayerProgressCard played={meRow?.played ?? 0} totalExpected={rr} />

          <section className="space-y-1.5 sm:space-y-2" aria-label="Grupo completo">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tdash-muted)] sm:text-sm">
              Tu grupo · {data.group.name}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-8">
                <ResultsMatrixCard
                  playerCount={data.players.length}
                  matchCount={data.matches.filter((m) => m.winner_id).length}
                  players={simPlayers}
                  matches={simMatches}
                  standings={tableStand}
                />
              </div>
              <div className="min-w-0 lg:col-span-4">
                <div className="lg:sticky lg:top-4 xl:top-6">
                  <GroupRankingCard rows={tableStand} fullGroup />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-1.5 sm:space-y-2" aria-label="Tu actividad">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tdash-muted)] sm:text-sm">
              Tu actividad
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
              <div className="space-y-4 sm:space-y-6 lg:col-span-8">
                <UpcomingMatchesCard
                  groupName={data.group.name}
                  matches={upcoming as MatchRow[]}
                  playersById={playersById as Map<string, GroupPlayer>}
                  myGroupPlayerId={myGp.id}
                  tournamentId={data.tournament.id}
                  groupId={gId}
                  allowScoreEntry={data.rules.allow_player_score_entry}
                />
                <SimMyResultsCard
                  myPlayerId={myGp.id}
                  matches={simMatches}
                  players={simPlayers}
                  listSubtitle="Torneo real"
                  getPointsText={buildPointsText(data.rules)}
                />
              </div>
              <div className="space-y-4 sm:space-y-6 lg:col-span-4">
                <PlayerGroupCard
                  groupName={data.group.name}
                  players={data.players as GroupPlayer[]}
                  currentUserId={userId}
                />
                <MyStandingCard standing={meRow} leader={leaderRow} />
                <PerformanceInsightCard lines={insightLinesLive} />
              </div>
            </div>
          </section>

          {showEmbeddedDemo && (
            <p className="text-center text-xs text-[var(--tdash-muted)]">
              <Link className="text-primary underline-offset-2 hover:underline" to="/simulation">
                Abrir simulación clásica (en memoria)
              </Link>
            </p>
          )}
        </div>
      </div>
    )
  }

  // Sin grupo activo: vacío + demo opcional
  return (
    <div className="tdash-root min-h-screen bg-[var(--tdash-bg)]">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-0 py-6 sm:py-8">
        <div className="space-y-2 rounded-2xl border border-dashed border-[var(--tdash-border)] bg-[var(--tdash-surface)] p-6 text-center sm:p-8">
          <h2 className="text-lg font-semibold text-[var(--tdash-text)]">Aún no estás en un torneo activo</h2>
          <p className="text-sm text-[var(--tdash-muted)]">
            Pide a la organización que te inscriba o revisa un torneo en curso. También puedes
            probar la matriz y flujo en entorno aislado.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Link
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              to="/tournaments"
            >
              Ver torneos
            </Link>
            <Link
              className="inline-flex h-9 items-center rounded-md border border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-4 text-sm"
              to="/simulation"
            >
              Simulación
            </Link>
          </div>
        </div>

        {showEmbeddedDemo ? (
          <>
            <PlayerWelcomeHero
              firstName={firstNameFromProfile(profile?.full_name)}
              tournamentName={demo.tournamentName}
              groupName={dGroup.name}
              tournamentStatus="active"
              subline="Vista de demostración: grupo fijo; tu usuario real no participa aún."
            />
            <PlayerQuickStats standing={standingDemo} />
            <PlayerProgressCard played={playedCountDemo} totalExpected={totalPerPlayer} />
            <section className="space-y-1.5 sm:space-y-2" aria-label="Grupo de demostración">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tdash-muted)] sm:text-sm">
                Grupo de demostración
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-8">
                  <ResultsMatrixCard
                    playerCount={playersForUi.length}
                    matchCount={dMatches.length}
                    players={playersForUi}
                    matches={dMatches}
                    standings={groupStandingForMatrix}
                  />
                </div>
                <div className="min-w-0 lg:col-span-4">
                  <div className="lg:sticky lg:top-4 xl:top-6">
                    <GroupRankingCard rows={groupStandingForMatrix} fullGroup />
                  </div>
                </div>
              </div>
            </section>
            <section className="space-y-1.5 sm:space-y-2" aria-label="Actividad demo">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tdash-muted)] sm:text-sm">
                Actividad (demo)
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
                <div className="space-y-4 sm:space-y-6 lg:col-span-8">
                  <UpcomingMatchesCard
                    groupName={dGroup.name}
                    matches={[]}
                    playersById={new Map()}
                    myGroupPlayerId={myDemoPlayerId}
                    tournamentId="demo"
                    groupId={dGroup.id}
                    allowScoreEntry={false}
                  />
                  <SimMyResultsCard
                    myPlayerId={myDemoPlayerId}
                    matches={dMatches}
                    players={playersForUi}
                  />
                </div>
                <div className="space-y-4 sm:space-y-6 lg:col-span-4">
                  <PlayerGroupCard
                    groupName={dGroup.name}
                    players={groupPlayersUi}
                    currentUserId={userId}
                  />
                  <MyStandingCard standing={standingDemo} leader={leaderDemo} />
                  <PerformanceInsightCard lines={insightLinesDemo} />
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
