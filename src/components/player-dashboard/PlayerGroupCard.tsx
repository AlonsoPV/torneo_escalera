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
        'rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] shadow-[var(--tdash-shadow-lg)]',
        className,
      )}
    >
      <div className="border-b border-[var(--tdash-border)] bg-gradient-to-br from-[var(--tdash-surface)] to-[var(--tdash-surface-2)] px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--tdash-primary)]/10 text-[var(--tdash-primary)]">
            <Users className="size-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--tdash-text)]">{PLY_COPY.yourGroup}</h2>
            <p className="text-sm text-[var(--tdash-primary)]">{groupName}</p>
          </div>
        </div>
        <p className="mt-1 text-xs font-medium text-[var(--tdash-muted)]">{PLY_COPY.groupRivals}</p>
      </div>
      <ul className="divide-y divide-[var(--tdash-border)] p-2">
        {ordered.map((p) => {
          const isYou = p.user_id === currentUserId
          return (
            <li
              key={p.id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-colors',
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
