import { cn } from '@/lib/utils'
import { TDASH_COPY } from '@/lib/tournamentDashboardCopy'
import type { SimGroup } from '@/types/tournament'
import { Button } from '@/components/ui/button'

type Props = {
  groups: SimGroup[]
  value: string
  onChange: (groupId: string) => void
  playerCount?: number
  matchCount?: number
}

export function GroupNavigationBar(props: Props) {
  const { groups, value, onChange, playerCount, matchCount } = props
  const active = groups.find((g) => g.id === value)

  return (
    <section className="space-y-2 sm:space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--tdash-muted)] sm:text-xs">
        {TDASH_COPY.groupNav}
      </p>

      <div className="md:hidden">
        <div className="-mx-0.5 flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain px-0.5 pb-1 pt-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
          {groups.map((g) => {
            const isActive = g.id === value
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onChange(g.id)}
                className={cn(
                  'shrink-0 snap-start rounded-full border px-3 py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.98] sm:px-4 sm:py-2.5',
                  isActive
                    ? 'border-[var(--tdash-primary)] bg-[var(--tdash-primary)] text-white shadow-md'
                    : 'border-[var(--tdash-border)] bg-[var(--tdash-surface)] text-[var(--tdash-text)] shadow-sm',
                )}
              >
                {g.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="flex max-h-[min(40vh,22rem)] flex-wrap gap-2 overflow-y-auto rounded-2xl border border-[var(--tdash-border)] bg-[var(--tdash-surface)] p-2.5 shadow-[var(--tdash-shadow)]">
          {groups.map((g) => {
            const isActive = g.id === value
            return (
              <Button
                key={g.id}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-9 rounded-xl px-4 text-sm font-semibold transition-all duration-200',
                  isActive &&
                    'bg-[var(--tdash-primary)] text-white shadow-md hover:bg-[var(--tdash-primary-hover)] hover:text-white',
                  !isActive &&
                    'border border-[var(--tdash-border)] bg-[var(--tdash-surface-2)] text-[var(--tdash-text)] hover:bg-[var(--tdash-bg)]',
                )}
                onClick={() => onChange(g.id)}
              >
                {g.name}
              </Button>
            )
          })}
        </div>
      </div>

      {active && playerCount != null && matchCount != null ? (
        <p className="text-pretty text-xs leading-relaxed text-[var(--tdash-muted)] sm:text-sm">
          <span className="font-semibold text-[var(--tdash-text)]">{active.name}</span>
          {' · '}
          {playerCount} jugadores · {matchCount} partidos
        </p>
      ) : null}
    </section>
  )
}
