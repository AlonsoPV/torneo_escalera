import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TDASH_COPY } from '@/lib/tournamentDashboardCopy'
import { cn } from '@/lib/utils'
import type { GroupStandingRow } from '@/types/tournament'

type Props = {
  rows: GroupStandingRow[]
  /** Si es true, lista completa del grupo; si no, solo top 5. */
  fullGroup?: boolean
}

function rowSurface(position: number) {
  if (position === 1) {
    return 'border-l-[var(--tdash-gold)] bg-[var(--tdash-top1-bg)] shadow-[inset_0_0_0_1px_rgba(203,174,115,0.12)]'
  }
  if (position === 2) {
    return 'border-l-[var(--tdash-border)] bg-[var(--tdash-top2-bg)] text-[var(--tdash-top2-text)]'
  }
  if (position === 3) {
    return 'border-l-[var(--tdash-border)] bg-[var(--tdash-top3-bg)] text-[var(--tdash-top3-text)]'
  }
  return 'border-l-transparent bg-[var(--tdash-surface)]'
}

function posBadge(position: number) {
  return cn(
    'inline-flex size-9 items-center justify-center rounded-full text-sm font-bold tabular-nums ring-1 ring-inset transition-colors',
    position === 1 &&
      'bg-[var(--tdash-surface)] text-[var(--tdash-text)] ring-[var(--tdash-gold)]/40 shadow-sm',
    position === 2 && 'bg-[var(--tdash-surface)] ring-[var(--tdash-border)]',
    position === 3 && 'bg-[var(--tdash-surface)] ring-[var(--tdash-border)]',
    position > 3 && 'bg-[var(--tdash-surface-2)] text-[var(--tdash-muted)] ring-[var(--tdash-border)]',
  )
}

export function RankingList(props: Props) {
  const { rows, fullGroup = false } = props
  const [openId, setOpenId] = useState<string | null>(null)

  const top = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.position - b.position)
    return fullGroup ? sorted : sorted.slice(0, 5)
  }, [rows, fullGroup])

  if (top.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] px-6 py-14 text-center">
        <p className="text-sm font-medium text-[var(--tdash-muted)]">{TDASH_COPY.rankingEmpty}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 md:hidden">
        {top.map((r) => {
          const open = openId === r.playerId
          const leader = r.position === 1
          return (
            <div
              key={r.playerId}
              className={cn(
                'overflow-hidden rounded-2xl border border-[var(--tdash-border)] shadow-[var(--tdash-shadow)] transition-shadow duration-200 hover:shadow-[var(--tdash-shadow-lg)]',
                rowSurface(r.position),
                'border-l-[5px]',
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : r.playerId)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors',
                  'hover:bg-black/[0.02] active:bg-black/[0.04]',
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={posBadge(r.position)}>{r.position}</span>
                  <span
                    className={cn(
                      'truncate font-semibold',
                      leader ? 'text-[var(--tdash-text)]' : 'text-[var(--tdash-text)]',
                    )}
                  >
                    {r.displayName}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-lg font-bold tabular-nums text-[var(--tdash-primary)]">
                    {r.points}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--tdash-muted)]">
                    pts
                  </span>
                  <ChevronDown
                    className={cn('size-4 text-[var(--tdash-muted)] transition-transform', open && 'rotate-180')}
                  />
                </div>
              </button>
              {open ? (
                <div className="border-t border-[var(--tdash-border)] bg-[var(--tdash-surface-2)]/80 px-4 py-3">
                  <dl className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <dt className="font-medium text-[var(--tdash-muted)]">PJ</dt>
                      <dd className="font-mono font-semibold tabular-nums text-[var(--tdash-text)]">{r.played}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[var(--tdash-muted)]">PG</dt>
                      <dd className="font-mono font-semibold tabular-nums text-[var(--tdash-text)]">{r.won}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[var(--tdash-muted)]">PP</dt>
                      <dd className="font-mono font-semibold tabular-nums text-[var(--tdash-text)]">{r.lost}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow)]">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--tdash-border)] hover:bg-transparent">
                <TableHead className="w-14 text-[11px] font-bold uppercase tracking-wide text-[var(--tdash-muted)]">
                  #
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-[var(--tdash-muted)]">
                  Jugador
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wide text-[var(--tdash-muted)]">
                  PJ
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wide text-[var(--tdash-muted)]">
                  PG
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wide text-[var(--tdash-muted)]">
                  PP
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wide text-[var(--tdash-primary)]">
                  PTS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((r) => (
                <TableRow
                  key={r.playerId}
                  className={cn(
                    'border-[var(--tdash-border)] border-l-[5px] transition-colors hover:bg-[var(--tdash-bg)]/60',
                    rowSurface(r.position),
                  )}
                >
                  <TableCell className="py-3">
                    <span className={posBadge(r.position)}>{r.position}</span>
                  </TableCell>
                  <TableCell className="max-w-[12rem] py-3 font-semibold text-[var(--tdash-text)]">
                    <span className="line-clamp-2">{r.displayName}</span>
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono tabular-nums text-[var(--tdash-muted)]">
                    {r.played}
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono font-medium tabular-nums text-[var(--tdash-text)]">
                    {r.won}
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono tabular-nums text-[var(--tdash-muted)]">
                    {r.lost}
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono text-base font-bold tabular-nums text-[var(--tdash-primary)]">
                    {r.points}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
