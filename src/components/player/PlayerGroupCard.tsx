import { ChevronRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GroupPlayer } from '@/types/database'
import type { RankingRow } from '@/utils/ranking'

type Props = {
  groupName: string
  players: GroupPlayer[]
  ranking: RankingRow[]
  currentUserId: string
  groupDetailHref: string
  className?: string
}

function orderPlayers(players: GroupPlayer[], ranking: RankingRow[]): (GroupPlayer & { position?: number })[] {
  if (ranking.length === 0) {
    return [...players].sort(
      (a, b) => a.seed_order - b.seed_order || a.display_name.localeCompare(b.display_name),
    ) as (GroupPlayer & { position?: number })[]
  }
  const byUser = new Map(ranking.map((r) => [r.userId, r.position] as const))
  return [...players]
    .map((p) => ({ ...p, position: byUser.get(p.user_id) ?? undefined }))
    .sort(
      (a, b) =>
        (a.position ?? 999) - (b.position ?? 999) || a.display_name.localeCompare(b.display_name),
    )
}

export function PlayerGroupCard({
  groupName,
  players,
  ranking,
  currentUserId,
  groupDetailHref,
  className,
}: Props) {
  const ordered = orderPlayers(players, ranking)

  return (
    <section
      id="player-section-group"
      data-name="player-section-group"
      className={cn(
        'overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm',
        className,
      )}
    >
      <div className="border-b border-[#E2E8F0] px-4 py-4 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#1F5A4C]/10 text-[#1F5A4C]">
            <Users className="size-4" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#102A43]">{groupName}</h2>
            <p className="text-sm text-[#64748B]">Jugadores del grupo</p>
          </div>
        </div>
      </div>
      <ol className="divide-y divide-[#E2E8F0] px-2 py-1 sm:px-3">
        {ordered.map((p, i) => {
          const isYou = p.user_id === currentUserId
          const pos = p.position ?? i + 1
          return (
            <li
              key={p.id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 sm:px-3',
                isYou ? 'bg-[#1F5A4C]/6' : 'hover:bg-[#F8FAFC]',
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#F6F3EE] text-xs font-semibold text-[#64748B]">
                  {pos}
                </span>
                <span className={cn('truncate text-sm', isYou ? 'font-semibold text-[#102A43]' : 'text-[#102A43]')}>
                  {p.display_name}
                </span>
              </div>
              {isYou ? (
                <Badge variant="outline" className="shrink-0 border-[#1F5A4C]/25 bg-[#1F5A4C]/8 text-[#1F5A4C]">
                  Tú
                </Badge>
              ) : null}
            </li>
          )
        })}
      </ol>
      <div className="border-t border-[#E2E8F0] p-3 sm:p-4">
        <Link
          to={groupDetailHref}
          className={buttonVariants({
            variant: 'outline',
            className: 'w-full border-[#E2E8F0] text-[#1F5A4C] hover:bg-[#F6F3EE]',
          })}
        >
          Ver grupo completo
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </section>
  )
}
