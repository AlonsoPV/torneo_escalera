import { Trophy } from 'lucide-react'

import { ClubChip, ClubStatusPill } from '@/components/tournament-dashboard/ClubBannerPrimitives'
import { TDASH_COPY } from '@/lib/tournamentDashboardCopy'

export type TournamentHeroStats = {
  playerCount: number
  groupCount: number
  format?: string
}

type Props = {
  title?: string
  meta?: string
  stats?: TournamentHeroStats
  statusLabel?: string
  /** Línea superior premium (p. ej. «Panel oficial del torneo»). */
  eyebrow?: string
  /** Texto editorial bajo chips/estado; por defecto copy premium del club. */
  description?: string
}

function BannerAccentLine() {
  return <div className="tournament-club-banner__accent" aria-hidden />
}

function BannerIconArea() {
  return (
    <div className="tournament-club-banner__icon shrink-0">
      <div className="tournament-club-banner__icon-inner">
        <Trophy
          className="size-[1.35rem] text-[#faf9f6] drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] sm:size-7"
          strokeWidth={1.75}
          aria-hidden
        />
      </div>
    </div>
  )
}

export function TournamentClubBanner(props: Props) {
  const {
    title = TDASH_COPY.heroTitle,
    meta = TDASH_COPY.heroMeta,
    stats,
    statusLabel = TDASH_COPY.status,
    eyebrow = TDASH_COPY.heroEyebrow,
    description = TDASH_COPY.heroDescriptionClub,
  } = props

  const structured = stats != null
  const showMetaLine = Boolean(meta) && !structured

  return (
    <header className="tournament-club-banner group relative overflow-hidden">
      <div className="tournament-club-banner__radial" aria-hidden />
      <BannerAccentLine />

      <div className="tournament-club-banner__inner">
        <BannerIconArea />

        <div className="tournament-club-banner__content min-w-0">
          <span className="tournament-club-banner__eyebrow">{eyebrow}</span>

          <h1 className="tournament-club-banner__title">{title}</h1>

          {structured ? (
            <ul
              className="tournament-club-banner__chips flex list-none flex-wrap gap-2 p-0 sm:gap-2.5"
              aria-label="Resumen del torneo"
            >
              <li>
                <ClubChip>
                  {stats.playerCount} jugadores
                </ClubChip>
              </li>
              <li>
                <ClubChip>
                  {stats.groupCount} grupos
                </ClubChip>
              </li>
              {stats.format ? (
                <li>
                  <ClubChip>{stats.format}</ClubChip>
                </li>
              ) : null}
            </ul>
          ) : null}

          <div className="tournament-club-banner__status-row">
            <ClubStatusPill variant="active">{statusLabel}</ClubStatusPill>
          </div>

          {structured ? (
            <p className="tournament-club-banner__description">{description}</p>
          ) : showMetaLine ? (
            <p className="tournament-club-banner__description tournament-club-banner__description--meta">
              {meta}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  )
}
