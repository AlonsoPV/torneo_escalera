import { ChevronDown, ChevronUp, Crown, Medal, Trophy } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'

import { PlayerNameWithPhoneCopy } from '@/components/player/PlayerNameWithPhoneCopy'
import type { TournamentLeaderboardEntry } from '@/services/dashboard/tournamentDashboardService'
import { useRankPositionFlashKeys } from '@/lib/useRankPositionFlash'
import { cn } from '@/lib/utils'

const INITIAL_LEADERBOARD_VISIBLE = 5

/** Anchos alineados entre cabecera y filas (sm+). */
const COL_RANK = 'w-11 shrink-0 sm:w-12'
const COL_STAT = 'w-9 shrink-0 text-center sm:w-10'
const COL_PTS = 'w-[4.5rem] shrink-0 text-right sm:w-[5rem]'

function rowCardClass(position: number) {
  return cn(
    'rounded-xl border transition-colors duration-150',
    position === 1 &&
      'border-amber-200/90 bg-gradient-to-br from-amber-50/95 via-amber-50/50 to-card shadow-sm shadow-amber-900/5 ring-1 ring-amber-200/40 dark:border-amber-800/50 dark:from-amber-950/35 dark:via-amber-950/15 dark:to-card dark:ring-amber-900/30',
    position === 2 &&
      'border-slate-200/90 bg-gradient-to-br from-slate-50/90 via-slate-50/40 to-card shadow-sm ring-1 ring-slate-200/50 dark:border-slate-700/60 dark:from-slate-900/40 dark:via-slate-900/20 dark:to-card dark:ring-slate-700/40',
    position === 3 &&
      'border-orange-200/85 bg-gradient-to-br from-orange-50/90 via-orange-50/35 to-card shadow-sm ring-1 ring-orange-200/45 dark:border-orange-900/45 dark:from-orange-950/30 dark:via-orange-950/12 dark:to-card dark:ring-orange-900/35',
    position > 3 &&
      'border-border/60 bg-card/90 hover:border-border hover:bg-muted/25 dark:bg-card/50 dark:hover:bg-muted/20',
  )
}

function RankBadge({ position, compact }: { position: number; compact?: boolean }) {
  const podium = position <= 3
  const circle = cn(
    'flex items-center justify-center rounded-full font-bold tabular-nums shadow-sm ring-1 ring-inset',
    compact ? 'size-8 text-sm' : 'size-9 text-sm sm:size-10 sm:text-base',
    position === 1 &&
      'bg-gradient-to-b from-amber-100 to-amber-50 text-amber-950 ring-amber-300/70 dark:from-amber-900/70 dark:to-amber-950/50 dark:text-amber-50 dark:ring-amber-700/40',
    position === 2 &&
      'bg-gradient-to-b from-slate-100 to-slate-50 text-slate-900 ring-slate-300/70 dark:from-slate-700 dark:to-slate-800 dark:text-slate-100 dark:ring-slate-600/50',
    position === 3 &&
      'bg-gradient-to-b from-orange-100 to-orange-50 text-orange-950 ring-orange-300/65 dark:from-orange-900/55 dark:to-orange-950/45 dark:text-orange-50 dark:ring-orange-800/45',
    !podium && 'bg-muted/70 text-muted-foreground ring-border/50',
  )

  return (
    <div className={cn(COL_RANK, 'flex flex-col items-center justify-center', compact ? 'gap-0' : 'gap-0.5')}>
      {!compact ? (
        <span className="flex h-3.5 items-center justify-center sm:h-4" aria-hidden>
          {position === 1 ? (
            <Crown className="size-3.5 text-amber-600 dark:text-amber-400" />
          ) : position === 2 ? (
            <Medal className="size-3.5 text-slate-500 dark:text-slate-400" />
          ) : position === 3 ? (
            <Medal className="size-3.5 text-orange-600 dark:text-orange-400" />
          ) : null}
        </span>
      ) : null}
      <span className={circle} aria-label={`Posición ${position}`}>
        {position}
      </span>
    </div>
  )
}

function StatCell({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div className={cn(COL_STAT, className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground sm:text-[0.9375rem]">{value}</p>
    </div>
  )
}

function PointsPill({ points, compact }: { points: number; compact?: boolean }) {
  if (compact) {
    return (
      <div className="shrink-0 text-right leading-none">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Pts</span>
        <span className="mt-0.5 block text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
          {points}
        </span>
      </div>
    )
  }

  return (
    <div className={cn(COL_PTS, 'flex flex-col items-end justify-center gap-0.5')}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pts</span>
      <span
        className={cn(
          'inline-flex min-w-[3rem] items-center justify-end rounded-lg px-2 py-1 text-lg font-bold tabular-nums leading-none shadow-sm ring-1 ring-inset sm:min-w-[3.25rem] sm:px-2.5 sm:text-xl',
          'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/25',
        )}
      >
        {points}
      </span>
    </div>
  )
}

function MobileStatsRow({
  played,
  won,
  lost,
  setsDiff,
  gamesDiff,
}: {
  played: number
  won: number
  lost: number
  setsDiff: number
  gamesDiff: number
}) {
  const fmtDiff = (value: number) => (value > 0 ? `+${value}` : String(value))

  const items = [
    { label: 'PJ', value: played, title: 'Partidos jugados' },
    { label: 'PG', value: won, title: 'Partidos ganados' },
    { label: 'PP', value: lost, title: 'Partidos perdidos' },
    { label: 'S±', value: fmtDiff(setsDiff), title: 'Diferencia de sets' },
    { label: 'G±', value: fmtDiff(gamesDiff), title: 'Diferencia de games' },
  ] as const

  return (
    <div className="mt-1.5 flex flex-wrap items-center pl-[2.625rem] text-[11px] leading-tight text-muted-foreground">
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 ? (
            <span className="mx-1.5 text-border/80" aria-hidden>
              ·
            </span>
          ) : null}
          <span className="inline-flex items-baseline gap-0.5" title={item.title}>
            <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
            <span className="text-[9px] font-medium uppercase tracking-wide">{item.label}</span>
          </span>
        </Fragment>
      ))}
    </div>
  )
}

function LeaderboardDesktopHeader() {
  return (
    <div
      className="mb-2 hidden items-end gap-2 rounded-xl border border-border/45 bg-muted/45 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow-sm dark:bg-muted/30 sm:flex md:gap-3 md:px-4"
      aria-hidden
    >
      <div className={COL_RANK} />
      <div className="min-w-0 flex-1 pb-0.5 pl-0.5">Jugador</div>
      <div className={cn(COL_STAT, 'pb-0.5')}>PJ</div>
      <div className={cn(COL_STAT, 'pb-0.5')}>PG</div>
      <div className={cn(COL_STAT, 'pb-0.5')}>PP</div>
      <div className={cn(COL_STAT, 'hidden pb-0.5 md:block')}>S±</div>
      <div className={cn(COL_STAT, 'hidden pb-0.5 lg:block')}>G±</div>
      <div className={cn(COL_PTS, 'pb-0.5 text-right')}>Pts</div>
    </div>
  )
}

export function LeaderboardList({
  rows,
  highlightUserId,
  phoneByUserId,
}: {
  rows: TournamentLeaderboardEntry[]
  /** Resalta la fila del jugador actual (p. ej. vista `/player`). */
  highlightUserId?: string | null
  phoneByUserId?: ReadonlyMap<string, string | null>
}) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = rows.length > INITIAL_LEADERBOARD_VISIBLE
  const visibleRows = hasMore && !expanded ? rows.slice(0, INITIAL_LEADERBOARD_VISIBLE) : rows

  const flashKeys = useRankPositionFlashKeys(
    useMemo(() => rows.map((r) => ({ key: r.userId, position: r.position })), [rows]),
  )

  useEffect(() => {
    queueMicrotask(() => {
      setExpanded(false)
    })
  }, [rows.length])

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-gradient-to-b from-muted/20 to-muted/5 px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground shadow-inner ring-1 ring-border/40">
          <Trophy className="size-7 opacity-70" aria-hidden />
        </span>
        <div className="max-w-xs space-y-1">
          <p className="text-sm font-semibold text-foreground">Aún sin clasificación</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            El leaderboard aparecerá cuando haya resultados cerrados en los grupos.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-muted/15 p-2 shadow-sm ring-1 ring-black/[0.03] dark:bg-muted/10 dark:ring-white/[0.06] sm:p-3">
      <LeaderboardDesktopHeader />

      <ul className="flex flex-col gap-2 sm:gap-2.5">
        {visibleRows.map((r) => {
          const sd = r.setsFor - r.setsAgainst
          const gd = r.gamesFor - r.gamesAgainst
          const highlighted = highlightUserId && r.userId === highlightUserId
          const rankMoved = flashKeys.has(r.userId)

          return (
            <li
              key={`${r.userId}-${r.position}`}
              className={cn(
                rowCardClass(r.position),
                'px-3 py-2 sm:flex sm:items-center sm:gap-2 sm:px-4 sm:py-3',
                highlighted &&
                  'relative z-[1] shadow-[inset_0_0_0_2px] shadow-emerald-500/45 ring-emerald-500/30 dark:shadow-emerald-400/35',
                rankMoved &&
                  'motion-safe:ring-2 motion-safe:ring-emerald-500/30 motion-safe:transition-[box-shadow] motion-safe:duration-300',
              )}
            >
              {/* Mobile */}
              <div className="sm:hidden">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <RankBadge position={r.position} compact />
                    <div className="min-w-0 pt-0.5">
                      <PlayerNameWithPhoneCopy
                        name={r.displayName}
                        phone={phoneByUserId?.get(r.userId)}
                        nameClassName="text-sm font-semibold leading-tight text-foreground"
                      />
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.groupName}</p>
                    </div>
                  </div>
                  <PointsPill points={r.points} compact />
                </div>
                <MobileStatsRow
                  played={r.played}
                  won={r.won}
                  lost={r.lost}
                  setsDiff={sd}
                  gamesDiff={gd}
                />
              </div>

              {/* Tablet / desktop */}
              <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex md:gap-3">
                <RankBadge position={r.position} />
                <div className="min-w-0 flex-1">
                  <PlayerNameWithPhoneCopy
                    name={r.displayName}
                    phone={phoneByUserId?.get(r.userId)}
                    nameClassName="font-semibold text-foreground"
                  />
                  <p className="truncate text-xs text-muted-foreground">{r.groupName}</p>
                </div>
                <StatCell label="PJ" value={r.played} />
                <StatCell label="PG" value={r.won} />
                <StatCell label="PP" value={r.lost} />
                <div className={cn(COL_STAT, 'hidden md:block')}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">S±</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground sm:text-[0.9375rem]">
                    {sd >= 0 ? `+${sd}` : sd}
                  </p>
                </div>
                <div className={cn(COL_STAT, 'hidden lg:block')}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">G±</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground sm:text-[0.9375rem]">
                    {gd >= 0 ? `+${gd}` : gd}
                  </p>
                </div>
                <PointsPill points={r.points} />
              </div>
            </li>
          )
        })}
      </ul>

      {hasMore ? (
        <div className="mt-2 border-t border-border/40 pt-2">
          <button
            type="button"
            className="flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-border/50 bg-card/80 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:border-emerald-500/25 hover:bg-emerald-500/[0.06] hover:text-foreground active:bg-muted/40 dark:bg-card/40"
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
                Ver {rows.length - INITIAL_LEADERBOARD_VISIBLE} más · todas ({rows.length})
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  )
}
