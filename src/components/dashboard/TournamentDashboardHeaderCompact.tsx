import {
  TournamentClubBanner,
  type TournamentHeroStats,
} from '@/components/tournament-dashboard/TournamentClubBanner'
import type { ClubStatusVariant } from '@/components/tournament-dashboard/ClubBannerPrimitives'
import type { Tournament, TournamentStatus } from '@/types/database'

const statusLabel: Record<TournamentStatus, string> = {
  draft: 'Borrador',
  active: 'En curso',
  finished: 'Finalizado',
  archived: 'Archivado',
}

const statusVariant: Record<TournamentStatus, ClubStatusVariant> = {
  active: 'active',
  draft: 'draft',
  finished: 'finished',
  archived: 'finished',
}

export function TournamentDashboardHeaderCompact({
  tournament,
  stats,
}: {
  tournament: Tournament
  stats?: TournamentHeroStats
}) {
  const categoryOrSeason = [tournament.category, tournament.season].filter(Boolean).join(' · ') || undefined

  return (
    <TournamentClubBanner
      compact
      eyebrow="Dashboard del torneo"
      title={tournament.name}
      stats={stats}
      statusLabel={statusLabel[tournament.status]}
      statusVariant={statusVariant[tournament.status]}
      description="Ranking, avance y desempeño por grupo"
      meta={categoryOrSeason ?? 'Ranking, avance y desempeño por grupo'}
    />
  )
}
