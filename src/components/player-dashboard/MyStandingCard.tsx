import { PLY_COPY } from '@/lib/playerDashboardCopy'
import { cn } from '@/lib/utils'
import type { RankingRow } from '@/utils/ranking'

type Props = {
  standing: RankingRow | null
  leader: RankingRow | null
  className?: string
}

function posClass(position: number) {
  if (position === 1) return 'bg-[var(--tdash-top1-bg)] text-[var(--tdash-text)] ring-1 ring-[var(--tdash-gold)]/30'
  if (position === 2) return 'bg-[var(--tdash-top2-bg)] text-[var(--tdash-top2-text)]'
  if (position === 3) return 'bg-[var(--tdash-top3-bg)] text-[var(--tdash-top3-text)]'
  return 'bg-[var(--tdash-surface-2)] text-[var(--tdash-text)]'
}

export function MyStandingCard(props: Props) {
  const { standing, leader, className } = props
  if (!standing) {
    return (
      <section
        className={cn(
          'rounded-xl border border-dashed border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] p-4 text-center text-xs text-[var(--tdash-muted)] sm:rounded-2xl sm:p-6 sm:text-sm',
          className,
        )}
      >
        {PLY_COPY.standingTitle}: sin datos aún.
      </section>
    )
  }

  const gapToLeader =
    leader && standing.position > 1 ? Math.max(0, leader.points - standing.points) : null
  const setsDiff = standing.setsFor - standing.setsAgainst
  const gamesDiff = standing.gamesFor - standing.gamesAgainst

  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)] sm:rounded-2xl',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] px-4 py-3 sm:px-5 sm:py-4">
        <h2 className="text-base font-bold text-[var(--tdash-text)] sm:text-lg">{PLY_COPY.standingTitle}</h2>
      </div>
      <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <span
            className={cn(
              'inline-flex size-14 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tabular-nums sm:size-16 sm:rounded-2xl sm:text-3xl',
              posClass(standing.position),
            )}
          >
            {standing.position}°
          </span>
          <div className="min-w-0">
            <p className="text-pretty text-sm font-bold text-[var(--tdash-text)] sm:text-base">
              Vas en {standing.position}° lugar del grupo
            </p>
            {standing.position > 1 && leader ? (
              <p className="mt-0.5 text-pretty text-xs text-[var(--tdash-muted)] sm:text-sm">
                {gapToLeader != null && gapToLeader > 0 ? (
                  <>
                    A {gapToLeader} {gapToLeader === 1 ? 'punto' : 'puntos'} del liderato · {leader.displayName}
                  </>
                ) : (
                  <>Empatado a puntos con el primero: {leader.displayName}</>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-xs font-medium text-[var(--tdash-gold)] sm:text-sm">¡Vas liderando el grupo!</p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 sm:gap-3 sm:text-sm">
          <div className="rounded-lg bg-[var(--tdash-surface-2)] p-2 sm:rounded-xl sm:p-2.5">
            <dt className="text-[10px] font-medium text-[var(--tdash-muted)] sm:text-xs">Puntos</dt>
            <dd className="font-mono text-base font-bold tabular-nums text-[var(--tdash-primary)] sm:text-lg">
              {standing.points}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--tdash-surface-2)] p-2 sm:rounded-xl sm:p-2.5">
            <dt className="text-[10px] font-medium text-[var(--tdash-muted)] sm:text-xs">Jugados</dt>
            <dd className="font-mono text-base font-bold tabular-nums sm:text-lg">{standing.played}</dd>
          </div>
          <div className="rounded-lg bg-[var(--tdash-surface-2)] p-2 sm:rounded-xl sm:p-2.5">
            <dt className="text-[10px] font-medium text-[var(--tdash-muted)] sm:text-xs">G / P</dt>
            <dd className="font-mono text-base font-bold tabular-nums sm:text-lg">
              {standing.won} / {standing.lost}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--tdash-surface-2)] p-2 sm:rounded-xl sm:p-2.5">
            <dt className="text-[10px] font-medium text-[var(--tdash-muted)] sm:text-xs">Sets (F−C)</dt>
            <dd className="font-mono text-base font-bold tabular-nums text-[var(--tdash-text)] sm:text-lg">
              {setsDiff >= 0 ? '+' : ''}
              {setsDiff}
            </dd>
          </div>
          <div className="col-span-2 rounded-lg bg-[var(--tdash-surface-2)] p-2 sm:col-span-1 sm:rounded-xl sm:p-2.5">
            <dt className="text-[10px] font-medium text-[var(--tdash-muted)] sm:text-xs">Games (F−C)</dt>
            <dd className="font-mono text-base font-bold tabular-nums text-[var(--tdash-text)] sm:text-lg">
              {gamesDiff >= 0 ? '+' : ''}
              {gamesDiff}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
