import { GroupNavigationBar } from '@/components/tournament-dashboard/GroupNavigationBar'
import { GroupRankingCard } from '@/components/tournament-dashboard/GroupRankingCard'
import { ResultsMatrixCard } from '@/components/tournament-dashboard/ResultsMatrixCard'
import { TournamentHeroHeader } from '@/components/tournament-dashboard/TournamentHeroHeader'
import { TournamentTopStats } from '@/components/tournament-dashboard/TournamentTopStats'
import type { SimTournamentBundle } from '@/types/tournament'

type Props = {
  bundle: SimTournamentBundle
  groupId: string
  onGroupChange: (groupId: string) => void
  /** Totales del torneo (no del grupo) */
  totalPlayers: number
  totalGroups: number
  totalMatches: number
  heroTitle?: string
  heroMeta?: string
  statusLabel?: string
}

export function TournamentDashboardPage(props: Props) {
  const {
    bundle,
    groupId,
    onGroupChange,
    totalPlayers,
    totalGroups,
    totalMatches,
    heroTitle,
    heroMeta,
    statusLabel,
  } = props

  const players = bundle.playersByGroupId[groupId] ?? []
  const matches = bundle.matchesByGroupId[groupId] ?? []
  const standings = bundle.standingsByGroupId[groupId] ?? []

  const playedMatches = matches.length

  return (
    <div className="tdash-root min-h-screen bg-[var(--tdash-bg)]">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <TournamentHeroHeader title={heroTitle} meta={heroMeta} statusLabel={statusLabel} />
        <TournamentTopStats players={totalPlayers} groups={totalGroups} matches={totalMatches} />
        <GroupNavigationBar
          groups={bundle.groups}
          value={groupId}
          onChange={onGroupChange}
          playerCount={players.length}
          matchCount={playedMatches}
        />

        <div
          key={groupId}
          className="grid grid-cols-1 gap-6 duration-300 animate-in fade-in-0 slide-in-from-bottom-1 xl:grid-cols-12"
        >
          <div className="min-w-0 xl:col-span-8">
            <ResultsMatrixCard
              playerCount={players.length}
              matchCount={playedMatches}
              players={players}
              matches={matches}
              standings={standings}
            />
          </div>
          <div className="min-w-0 xl:col-span-4">
            <div className="xl:sticky xl:top-6">
              <GroupRankingCard rows={standings} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
