import { Trophy } from 'lucide-react'

import { ClubChip, ClubStatusPill, type ClubStatusVariant } from '@/components/tournament-dashboard/ClubBannerPrimitives'
import { TDASH_COPY } from '@/lib/tournamentDashboardCopy'
import { cn } from '@/lib/utils'

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
  statusVariant?: ClubStatusVariant
  /** Layout más bajo para dashboard operativo. */
  compact?: boolean
  /** Línea superior premium (p. ej. «Panel oficial del torneo»). */
  eyebrow?: string
  /** Texto editorial bajo chips/estado; por defecto copy premium del club. */
  description?: string
}

function BannerAccentLine() {
  return <div className="tournament-club-banner__accent" aria-hidden />
}

function BannerIconArea({ compact }: { compact?: boolean }) {
  return (
    <div className="tournament-club-banner__icon shrink-0">
      <div className="tournament-club-banner__icon-inner">
        <Trophy
          className={cn(
            'text-[#faf9f6] drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]',
            compact ? 'size-5 sm:size-[1.35rem]' : 'size-[1.35rem] sm:size-7',
          )}
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
    statusVariant = 'active',
    compact = false,
    eyebrow = TDASH_COPY.heroEyebrow,
    description = TDASH_COPY.heroDescriptionClub,
  } = props

  const structured = stats != null
  const showMetaLine = Boolean(meta) && !structured

  return (
    <header
      className={cn('tournament-club-banner group relative overflow-hidden', compact && 'tournament-club-banner--compact')}
    >
      <div className="tournament-club-banner__radial" aria-hidden />
      <BannerAccentLine />

      <div className="tournament-club-banner__inner">
        <BannerIconArea compact={compact} />

        <div className="tournament-club-banner__content min-w-0 flex-1">
          {compact ? (
            <>
              <div className="tournament-club-banner__headline-row flex min-w-0 items-start justify-between gap-2 sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <span className="tournament-club-banner__eyebrow">{eyebrow}</span>
                  <h1 className="tournament-club-banner__title truncate sm:text-balance sm:whitespace-normal">{title}</h1>
                </div>
                <ClubStatusPill variant={statusVariant}>{statusLabel}</ClubStatusPill>
              </div>

              {structured ? (
                <div className="tournament-club-banner__meta-row flex min-w-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2.5 sm:gap-y-1">
                  <ul
                    className="tournament-club-banner__chips m-0 flex list-none flex-wrap gap-1.5 p-0 sm:gap-2"
                    aria-label="Resumen del torneo"
                  >
                    <li>
                      <ClubChip>{stats.playerCount} jugadores</ClubChip>
                    </li>
                    <li>
                      <ClubChip>{stats.groupCount} grupos</ClubChip>
                    </li>
                    {stats.format ? (
                      <li>
                        <ClubChip>{stats.format}</ClubChip>
                      </li>
                    ) : null}
                  </ul>
                  <p className="tournament-club-banner__description tournament-club-banner__description--inline hidden min-w-0 sm:block">
                    {description}
                  </p>
                </div>
              ) : showMetaLine ? (
                <p className="tournament-club-banner__description tournament-club-banner__description--meta truncate">
                  {meta}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <span className="tournament-club-banner__eyebrow">{eyebrow}</span>

              <h1 className="tournament-club-banner__title">{title}</h1>

              {structured ? (
                <ul
                  className="tournament-club-banner__chips flex list-none flex-wrap gap-2 p-0 sm:gap-2.5"
                  aria-label="Resumen del torneo"
                >
                  <li>
                    <ClubChip>{stats.playerCount} jugadores</ClubChip>
                  </li>
                  <li>
                    <ClubChip>{stats.groupCount} grupos</ClubChip>
                  </li>
                  {stats.format ? (
                    <li>
                      <ClubChip>{stats.format}</ClubChip>
                    </li>
                  ) : null}
                </ul>
              ) : null}

              <div className="tournament-club-banner__status-row">
                <ClubStatusPill variant={statusVariant}>{statusLabel}</ClubStatusPill>
              </div>

              {structured ? (
                <p className="tournament-club-banner__description">{description}</p>
              ) : showMetaLine ? (
                <p className="tournament-club-banner__description tournament-club-banner__description--meta">{meta}</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
