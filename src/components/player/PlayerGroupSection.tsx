import { Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RankingRow } from '@/utils/ranking'

type Props = {
  groupName: string
  ranking: RankingRow[]
  currentUserId: string
  className?: string
}

function gamesDiffLabel(row: RankingRow): string | null {
  const d = row.gamesFor - row.gamesAgainst
  if (row.played === 0 && d === 0) return null
  if (d === 0) return 'Dif. 0'
  return `Dif. ${d > 0 ? '+' : ''}${d}`
}

export function PlayerGroupSection({ groupName, ranking, currentUserId, className }: Props) {
  return (
    <section
      id="player-section-group"
      data-name="player-section-group"
      className={cn('overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm', className)}
    >
      <div className="border-b border-[#E2E8F0] px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#1F5A4C]/10 text-[#1F5A4C] sm:size-9">
            <Users className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#102A43] sm:text-lg">{groupName}</h2>
            <p className="text-xs text-[#64748B] sm:text-sm">Ranking · jugadores del grupo</p>
          </div>
        </div>
      </div>
      <ol className="divide-y divide-[#E2E8F0]">
        {ranking.map((row) => {
          const isYou = row.userId === currentUserId
          const secondary = gamesDiffLabel(row)
          const ptsLabel = row.points === 1 ? '1 pt' : `${row.points} pts`
          return (
            <li
              key={row.groupPlayerId}
              className={cn(
                'flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5',
                isYou ? 'bg-[#1F5A4C]/[0.06]' : '',
              )}
            >
              <span className="w-7 shrink-0 tabular-nums text-xs font-bold text-[#64748B] sm:w-8 sm:text-sm">
                #{row.position}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm sm:text-base',
                  isYou ? 'font-semibold text-[#102A43]' : 'font-medium text-[#102A43]',
                )}
              >
                {row.displayName.toUpperCase()}
              </span>
              <span className="shrink-0 tabular-nums text-sm font-semibold text-[#1F5A4C] sm:text-base">{ptsLabel}</span>
              {isYou ? (
                <Badge variant="outline" className="shrink-0 border-[#1F5A4C]/30 bg-[#1F5A4C]/10 px-1.5 py-0 text-[10px] text-[#1F5A4C]">
                  Tú
                </Badge>
              ) : (
                <span className="w-7 shrink-0 sm:w-9" aria-hidden />
              )}
              {secondary ? (
                <span className="hidden shrink-0 text-[10px] tabular-nums text-[#94a3b8] sm:inline">{secondary}</span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
