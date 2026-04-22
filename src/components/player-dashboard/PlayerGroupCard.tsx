import { Users } from 'lucide-react'

import { PLY_COPY } from '@/lib/playerDashboardCopy'
import { cn } from '@/lib/utils'
import type { GroupPlayer } from '@/types/database'

type Props = {
  groupName: string
  players: GroupPlayer[]
  currentUserId: string
  className?: string
}

export function PlayerGroupCard(props: Props) {
  const { groupName, players, currentUserId, className } = props
  const ordered = [...players].sort(
    (a, b) => a.seed_order - b.seed_order || a.display_name.localeCompare(b.display_name),
  )

  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)] sm:rounded-2xl',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] to-[var(--tdash-surface-2)] px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--tdash-primary)]/10 text-[var(--tdash-primary)] sm:size-9 sm:rounded-xl">
            <Users className="size-3.5 sm:size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--tdash-text)] sm:text-base">{PLY_COPY.yourGroup}</h2>
            <p className="truncate text-xs text-[var(--tdash-primary)] sm:text-sm">{groupName}</p>
          </div>
        </div>
        <p className="mt-1 text-[11px] font-medium text-[var(--tdash-muted)] sm:text-xs">{PLY_COPY.groupRivals}</p>
      </div>
      <ul className="divide-y divide-[var(--tdash-border)] p-1.5 sm:p-2">
        {ordered.map((p) => {
          const isYou = p.user_id === currentUserId
          return (
            <li
              key={p.id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors sm:rounded-xl sm:px-3 sm:py-2.5',
                isYou
                  ? 'bg-[var(--tdash-top1-bg)] ring-1 ring-[var(--tdash-gold)]/25'
                  : 'hover:bg-[var(--tdash-surface-2)]',
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--tdash-surface-2)] font-mono text-xs font-bold text-[var(--tdash-muted)]">
                  {p.seed_order}
                </span>
                <span
                  className={cn(
                    'truncate font-medium',
                    isYou ? 'font-bold text-[var(--tdash-text)]' : 'text-[var(--tdash-text)]',
                  )}
                >
                  {p.display_name}
                </span>
                {isYou ? (
                  <span className="shrink-0 rounded-full bg-[var(--tdash-primary)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {PLY_COPY.youBadge}
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
