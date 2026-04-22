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
          'rounded-2xl border border-dashed border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] p-6 text-center text-sm text-[var(--tdash-muted)]',
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
        'rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)]',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] px-5 py-4">
        <h2 className="text-lg font-bold text-[var(--tdash-text)]">{PLY_COPY.standingTitle}</h2>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'inline-flex size-16 shrink-0 items-center justify-center rounded-2xl text-3xl font-bold tabular-nums',
              posClass(standing.position),
            )}
          >
            {standing.position}°
          </span>
          <div>
            <p className="text-base font-bold text-[var(--tdash-text)]">
              Vas en {standing.position}° lugar del grupo
            </p>
            {standing.position > 1 && leader ? (
              <p className="mt-0.5 text-sm text-[var(--tdash-muted)]">
                {gapToLeader != null && gapToLeader > 0 ? (
                  <>
                    A {gapToLeader} {gapToLeader === 1 ? 'punto' : 'puntos'} del liderato · {leader.displayName}
                  </>
                ) : (
                  <>Empatado a puntos con el primero: {leader.displayName}</>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-sm font-medium text-[var(--tdash-gold)]">¡Vas liderando el grupo!</p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--tdash-surface-2)] p-2.5">
            <dt className="text-xs font-medium text-[var(--tdash-muted)]">Puntos</dt>
            <dd className="font-mono text-lg font-bold tabular-nums text-[var(--tdash-primary)]">
              {standing.points}
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--tdash-surface-2)] p-2.5">
            <dt className="text-xs font-medium text-[var(--tdash-muted)]">Jugados</dt>
            <dd className="font-mono text-lg font-bold tabular-nums">{standing.played}</dd>
          </div>
          <div className="rounded-xl bg-[var(--tdash-surface-2)] p-2.5">
            <dt className="text-xs font-medium text-[var(--tdash-muted)]">G / P</dt>
            <dd className="font-mono text-lg font-bold tabular-nums">
              {standing.won} / {standing.lost}
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--tdash-surface-2)] p-2.5">
            <dt className="text-xs font-medium text-[var(--tdash-muted)]">Sets (F−C)</dt>
            <dd className="font-mono text-lg font-bold tabular-nums text-[var(--tdash-text)]">
              {setsDiff >= 0 ? '+' : ''}
              {setsDiff}
            </dd>
          </div>
          <div className="col-span-2 rounded-xl bg-[var(--tdash-surface-2)] p-2.5 sm:col-span-1">
            <dt className="text-xs font-medium text-[var(--tdash-muted)]">Games (F−C)</dt>
            <dd className="font-mono text-lg font-bold tabular-nums text-[var(--tdash-text)]">
              {gamesDiff >= 0 ? '+' : ''}
              {gamesDiff}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
