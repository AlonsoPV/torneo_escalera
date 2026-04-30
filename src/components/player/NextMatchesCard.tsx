import { Calendar, ChevronRight, MapPin, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { canPlayerACaptureScore, canPlayerBRespondToScore, getOpponentInMatch } from '@/lib/matchStatus'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'
import { tournamentPathWithGroup } from '@/lib/tournamentUrl'
import { cn } from '@/lib/utils'

function statusLine(m: MatchRow): string {
  if (m.status === 'cancelled') return 'Cancelado'
  if (m.status === 'scheduled') return 'Programado'
  if (m.status === 'ready_for_score') return 'Listo para marcador'
  if (m.status === 'score_submitted') return 'Marcador enviado (revisión del rival)'
  if (m.status === 'score_disputed') return 'Marcador en disputa'
  if (m.status === 'player_confirmed') return 'Aceptado por rival · pendiente admin'
  if (m.status === 'admin_validated') return 'Validado por admin'
  if (m.status === 'closed') return 'Cerrado'
  return 'En seguimiento'
}

function whenLabel(m: MatchRow): { date: string; time: string } {
  const d = m.scheduled_date
    ? new Date(m.scheduled_date + (m.scheduled_start_at ? '' : 'T12:00:00'))
    : m.scheduled_start_at
      ? new Date(m.scheduled_start_at)
      : null
  if (!d || Number.isNaN(d.getTime())) return { date: 'Por confirmar', time: '—' }
  const date = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
  if (m.scheduled_start_at) {
    const t = new Date(m.scheduled_start_at)
    const time = Number.isNaN(t.getTime())
      ? '—'
      : new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(t)
    return { date, time }
  }
  return { date, time: '—' }
}

type Props = {
  matches: MatchRow[]
  players: GroupPlayer[]
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
            <span className="text-xs">Ya completaste todos tus juegos de grupo, o el calendario está al día.</span>
          </p>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => {
              const rival = getOpponentInMatch(m, myGroupPlayerId, players)
              const { date, time } = whenLabel(m)
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
                    <p className="font-semibold text-[#102A43]">vs. {rival?.display_name ?? 'Rival'}</p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {groupName} · {statusLine(m)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748B]">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3.5" aria-hidden />
                        {date}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden />
                        {time}
                      </span>
                      {m.location ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{m.location}</span>
                        </span>
                      ) : null}
                    </div>
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
