import { Sparkles } from 'lucide-react'

import { ClubChip, ClubStatusPill, type ClubStatusVariant } from '@/components/tournament-dashboard/ClubBannerPrimitives'
import { PLY_COPY } from '@/lib/playerDashboardCopy'
import { cn } from '@/lib/utils'
import type { TournamentStatus } from '@/types/database'

type Props = {
  firstName: string
  /** Si no se pasa, se usa un título genérico de panel. */
  tournamentName?: string
  /** Si no se pasa, no se muestra el chip de grupo. */
  groupName?: string
  tournamentStatus?: TournamentStatus
  /** Texto bajo el título; por defecto el copy de bienvenida. */
  subline?: string
  className?: string
}

function statusVariant(t: TournamentStatus): { variant: ClubStatusVariant; label: string } {
  switch (t) {
    case 'active':
      return { variant: 'active', label: 'En curso' }
    case 'finished':
      return { variant: 'finished', label: 'Finalizado' }
    case 'archived':
      return { variant: 'finished', label: 'Archivado' }
    default:
      return { variant: 'draft', label: 'Borrador' }
  }
}

export function PlayerWelcomeHero(props: Props) {
  const {
    firstName,
    tournamentName = 'Tu panel de jugador',
    groupName,
    tournamentStatus = 'active',
    subline = PLY_COPY.welcomeSub,
    className,
  } = props
  const status = statusVariant(tournamentStatus)
  const showGroupChip = groupName != null && groupName.length > 0

  return (
    <header
      className={cn(
        'tournament-club-banner tournament-club-banner--welcome group relative overflow-hidden',
        className,
      )}
    >
      <div className="tournament-club-banner__radial" aria-hidden />
      <div className="tournament-club-banner__accent" aria-hidden />

      <div className="tournament-club-banner__inner">
        <div className="tournament-club-banner__icon shrink-0">
          <div className="tournament-club-banner__icon-inner">
            <Sparkles
              className="size-[1.35rem] text-[#faf9f6] drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] sm:size-7"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
        </div>

        <div className="tournament-club-banner__content min-w-0">
          <span className="tournament-club-banner__eyebrow">{PLY_COPY.welcomeEyebrow}</span>

          <p className="tournament-club-banner__greeting">
            Hola,{' '}
            <span className="tournament-club-banner__greeting-name">{firstName}</span>
            <span className="tournament-club-banner__greeting-tagline"> — {PLY_COPY.welcomeTagline}</span>
          </p>

          <h1 className="tournament-club-banner__title">{tournamentName}</h1>

          {showGroupChip ? (
            <ul
              className="tournament-club-banner__chips tournament-club-banner__chips--welcome flex list-none flex-wrap gap-2 p-0 sm:gap-2.5"
              aria-label="Tu grupo"
            >
              <li>
                <ClubChip>{groupName}</ClubChip>
              </li>
            </ul>
          ) : null}

          <div className="tournament-club-banner__status-row">
            <ClubStatusPill variant={status.variant}>{status.label}</ClubStatusPill>
          </div>

          <p className="tournament-club-banner__description">{subline}</p>
        </div>
      </div>
    </header>
  )
}
