import { History } from 'lucide-react'
import { Link } from 'react-router-dom'

import { getMatchOutcome, getPointsForPlayerInMatch } from '@/lib/playerDashboard'
import { getOpponentInMatch } from '@/lib/matchStatus'
import { getPlayerPerspectiveScore } from '@/lib/matchUserPerspective'
import { buttonVariants } from '@/components/ui/button'
import type { GroupPlayer, MatchResultType, MatchRow, TournamentRules } from '@/types/database'
import { cn } from '@/lib/utils'

function outcomeText(
  match: MatchRow,
  myGroupPlayerId: string,
  resultType: MatchResultType | null,
): string {
  if (match.winner_id == null) return '—'
  const isDefault = resultType && resultType !== 'normal'
  const w = getMatchOutcome(match, myGroupPlayerId)
  if (isDefault) {
    if (w === 'win') return 'Ganaste (W.O.)'
    if (w === 'loss') return 'Perdiste (W.O.)'
  }
  if (w === 'win') return 'Ganaste'
  if (w === 'loss') return 'Perdiste'
  return '—'
}

type Props = {
  matches: MatchRow[]
  players: GroupPlayer[]
  myGroupPlayerId: string
  userId: string
  rules: Pick<
    TournamentRules,
    'points_per_win' | 'points_per_loss' | 'points_default_win' | 'points_default_loss'
  >
  seeAllHref: string
  className?: string
}

export function MatchHistoryCard({
  matches,
  players,
  myGroupPlayerId,
  userId,
  rules,
  seeAllHref,
  className,
}: Props) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm',
        className,
      )}
    >
      <div className="border-b border-[#E2E8F0] bg-gradient-to-r from-white to-[#F6F3EE]/80 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#F6F3EE] text-[#1F5A4C]">
            <History className="size-4" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#102A43]">Historial</h2>
            <p className="text-sm text-[#64748B]">Marcador desde tu perspectiva</p>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        {matches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F6F3EE]/50 px-4 py-8 text-center text-sm text-[#64748B]">
            Aún no tienes juegos registrados.
          </p>
        ) : (
          <ul className="divide-y divide-[#E2E8F0]">
            {matches.slice(0, 6).map((m) => {
              const rival = getOpponentInMatch(m, myGroupPlayerId, players)
              const label = getPlayerPerspectiveScore(m, userId)
              const pts = getPointsForPlayerInMatch(m, myGroupPlayerId, rules)
              const out = outcomeText(m, myGroupPlayerId, m.result_type)
              const when = new Date(m.updated_at)
              const whenStr = Number.isNaN(when.getTime())
                ? '—'
                : new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(when)

              return (
                <li key={m.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-[#102A43]">vs. {rival?.display_name ?? 'Rival'}</p>
                  <p className="mt-0.5 text-sm text-[#64748B]">
                    {out} · {label} · {pts >= 0 ? `+${pts} pts` : `${pts} pts`} · {whenStr}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
        {matches.length > 0 ? (
          <div className="mt-4 text-center">
            <Link
              to={seeAllHref}
              className={buttonVariants({ variant: 'link', className: 'text-[#1F5A4C] text-sm' })}
            >
              Ver todos mis resultados
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}
