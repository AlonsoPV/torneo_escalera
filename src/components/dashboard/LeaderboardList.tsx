import { ChevronDown, ChevronUp, Crown, Medal } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { TournamentLeaderboardEntry } from '@/services/dashboard/tournamentDashboardService'
import { cn } from '@/lib/utils'

const INITIAL_LEADERBOARD_VISIBLE = 5

function podiumSurface(position: number) {
  if (position === 1) {
    return 'bg-gradient-to-r from-amber-100/95 via-amber-50/80 to-amber-50/40 dark:from-amber-950/45 dark:via-amber-950/25 dark:to-amber-950/10 ring-1 ring-amber-200/60 dark:ring-amber-800/40'
  }
  if (position === 2) {
    return 'bg-slate-100/85 dark:bg-slate-800/45 ring-1 ring-slate-200/70 dark:ring-slate-600/40'
  }
  if (position === 3) {
    return 'bg-orange-50/90 dark:bg-orange-950/30 ring-1 ring-orange-200/55 dark:ring-orange-900/35'
  }
  return 'hover:bg-muted/35'
}

function RankBadge({ position }: { position: number }) {
  const podium = position <= 3
  return (
    <div
      className={cn(
        'flex w-8 shrink-0 flex-col items-center justify-center gap-0.5 sm:w-9',
        podium && 'font-semibold text-foreground',
      )}
    >
      {position === 1 ? (
        <Crown className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
      ) : position <= 3 ? (
        <Medal
          className={cn(
            'size-3.5',
            position === 2 && 'text-slate-500 dark:text-slate-400',
            position === 3 && 'text-orange-600 dark:text-orange-400',
          )}
          aria-hidden
        />
      ) : null}
      <span className={cn('text-sm tabular-nums sm:text-base', !podium && 'font-semibold text-muted-foreground')}>
        #{position}
      </span>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-[2.25rem] text-center sm:min-w-[2.5rem]">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

export function LeaderboardList({
  rows,
  highlightUserId,
}: {
  rows: TournamentLeaderboardEntry[]
  /** Resalta la fila del jugador actual (p. ej. vista `/player`). */
  highlightUserId?: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = rows.length > INITIAL_LEADERBOARD_VISIBLE
  const visibleRows = hasMore && !expanded ? rows.slice(0, INITIAL_LEADERBOARD_VISIBLE) : rows

  useEffect(() => {
    setExpanded(false)
  }, [rows.length])

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
        El ranking aparecerá cuando existan resultados cerrados.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card/40 dark:bg-card/20">
      <ul className="overflow-hidden">
      {visibleRows.map((r) => {
        const sd = r.setsFor - r.setsAgainst
        const gd = r.gamesFor - r.gamesAgainst
        return (
          <li
            key={`${r.userId}-${r.position}`}
            className={cn(
              'border-b border-border/40 transition-colors duration-150 last:border-b-0',
              podiumSurface(r.position),
              highlightUserId &&
                r.userId === highlightUserId &&
                'relative z-[1] shadow-[inset_0_0_0_2px] shadow-emerald-600/35 dark:shadow-emerald-400/30',
            )}
          >
            {/* Mobile: dos líneas */}
            <div className="px-2.5 py-2 sm:hidden">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <RankBadge position={r.position} />
                  <div className="min-w-0 pt-0.5">
                    <p className="truncate font-medium text-foreground">{r.displayName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.groupName}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
                    {r.points}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">pts</p>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between border-t border-border/30 pt-1.5 pl-10 pr-0.5">
                <div className="flex gap-4">
                  <StatCell label="PJ" value={r.played} />
                  <StatCell label="PG" value={r.won} />
                  <StatCell label="PP" value={r.lost} />
                </div>
              </div>
            </div>

            {/* Desktop / tablet: una fila escaneable */}
            <div className="hidden items-center justify-between gap-3 px-3 py-2.5 sm:flex md:px-4 md:py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <RankBadge position={r.position} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.groupName}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4 md:gap-5 lg:gap-6">
                <StatCell label="PJ" value={r.played} />
                <StatCell label="PG" value={r.won} />
                <StatCell label="PP" value={r.lost} />
                <div className="hidden text-center md:block lg:min-w-[2.75rem]">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">S±</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">{sd >= 0 ? `+${sd}` : sd}</p>
                </div>
                <div className="hidden text-center lg:block lg:min-w-[2.75rem]">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">G±</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">{gd >= 0 ? `+${gd}` : gd}</p>
                </div>
                <div className="border-l border-border/50 pl-4 text-right md:pl-5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pts</p>
                  <p className="text-lg font-bold tabular-nums leading-tight text-emerald-600 dark:text-emerald-400">
                    {r.points}
                  </p>
                </div>
              </div>
            </div>
          </li>
        )
      })}
      </ul>
      {hasMore ? (
        <div className="border-t border-border/40 bg-muted/5 px-2 py-2 sm:px-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <ChevronUp className="size-4 shrink-0" aria-hidden />
                Ver menos
              </>
            ) : (
              <>
                <ChevronDown className="size-4 shrink-0" aria-hidden />
                Ver {rows.length - INITIAL_LEADERBOARD_VISIBLE} más · mostrar todas ({rows.length})
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  )
}
