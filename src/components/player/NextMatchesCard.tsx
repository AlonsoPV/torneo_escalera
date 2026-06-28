import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { PlayerNameWithPhoneCopy } from '@/components/player/PlayerNameWithPhoneCopy'
import { canPlayerACaptureScore, canPlayerBRespondToScore, getOpponentInMatch } from '@/lib/matchStatus'
import type { GroupPlayerContact, MatchRow, TournamentRules } from '@/types/database'
import { tournamentPathWithGroup } from '@/lib/tournamentUrl'
import { cn } from '@/lib/utils'

function statusLine(m: MatchRow): string {
  if (m.status === 'cancelled') return 'Cancelado'
  if (m.status === 'pending_score') return 'Pendiente de marcador'
  if (m.status === 'score_submitted') return 'Confirmado para tabla · puede refutarse'
  if (m.status === 'score_disputed') return 'Marcador en disputa'
  if (m.status === 'player_confirmed') return 'Sin refutación · pendiente organizador'
  if (m.status === 'closed' || m.status === 'validated') return 'Cerrado'
  return 'En seguimiento'
}

type Props = {
  matches: MatchRow[]
  players: GroupPlayerContact[]
  myGroupPlayerId: string
  userId: string
  tournamentId: string
  tournamentName: string
  groupId: string
  groupName: string
  rules: Pick<TournamentRules, 'allow_player_score_entry'>
  className?: string
}

export function NextMatchesCard({
  matches,
  players,
  myGroupPlayerId,
  userId,
  tournamentId,
  tournamentName,
  groupId,
  groupName,
  rules,
  className,
}: Props) {
  const matrixPath = tournamentPathWithGroup(
    { id: tournamentId, name: tournamentName },
    groupId,
  )

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm',
        className,
      )}
    >
      <div className="border-b border-[#E2E8F0] bg-gradient-to-r from-white to-[#F6F3EE]/80 px-4 py-4 sm:px-5 sm:py-5">
        <h2 className="text-lg font-semibold text-[#102A43]">Próximos juegos</h2>
        <p className="mt-0.5 text-sm text-[#64748B]">Partidos por jugar o pendientes de cierre de marcador</p>
      </div>
      <div className="p-3 sm:p-4">
        {matches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F6F3EE]/50 px-4 py-8 text-center text-sm text-[#64748B]">
            No tienes juegos pendientes.
            <br />
            <span className="text-xs">Ya completaste todos tus juegos de grupo, o no hay cruces pendientes.</span>
          </p>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => {
              const rival = getOpponentInMatch(m, myGroupPlayerId, players)
              const canRespond = canPlayerBRespondToScore({
                match: m,
                userId,
                allowPlayerScoreEntry: rules.allow_player_score_entry,
              })
              const canCaptureA = canPlayerACaptureScore({
                match: m,
                userId,
                allowPlayerScoreEntry: rules.allow_player_score_entry,
              })
              const canMark = canCaptureA || canRespond

              return (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex max-w-full items-center">
                      <PlayerNameWithPhoneCopy
                        name={rival?.display_name ?? 'Rival'}
                        phone={rival?.phone}
                        prefix="vs."
                        nameClassName="font-semibold text-[#102A43]"
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {groupName} · {statusLine(m)}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row">
                    {canMark ? (
                      <Link
                        to={matrixPath}
                        className={buttonVariants({ size: 'sm', className: 'w-full justify-center sm:w-auto' })}
                      >
                        {canRespond ? 'Revisar marcador' : 'Registrar marcador'}
                        <ChevronRight className="size-4" />
                      </Link>
                    ) : (
                      <Link
                        to={matrixPath}
                        className={buttonVariants({
                          variant: 'outline',
                          size: 'sm',
                          className: 'w-full justify-center sm:w-auto',
                        })}
                      >
                        Ver detalle
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
