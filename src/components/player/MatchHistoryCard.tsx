import { History } from 'lucide-react'

import { PlayerNameWithPhoneCopy } from '@/components/player/PlayerNameWithPhoneCopy'
import { getOpponentInMatch, matchStatusLabels, matchStatusToneClasses } from '@/lib/matchStatus'
import {
  importResultTypeBothPenalized,
  importResultTypeIsRetiredDraw,
  importResultTypeUsesDefaultPoints,
} from '@/lib/matchResultSemantics'
import {
  calculateMatchGamesDifference,
  getMatchOutcome,
  getPointsForPlayerInMatch,
} from '@/lib/playerDashboard'
import { getPlayerPerspectiveScore } from '@/lib/matchUserPerspective'
import type { GroupPlayerContact, MatchResultType, MatchRow, MatchStatus, TournamentRules } from '@/types/database'
import { cn } from '@/lib/utils'

const HISTORY_SECTION_ORDER: MatchStatus[] = [
  'closed',
  'score_submitted',
  'player_confirmed',
  'score_disputed',
  'pending_score',
  'cancelled',
]

const SECTION_HEADING: Partial<Record<MatchStatus, string>> = {
  closed: 'Resultados oficiales',
  score_submitted: 'Confirmado para tabla · puede refutarse',
  player_confirmed: 'Sin refutación · pendiente organizador',
  score_disputed: 'En disputa',
  pending_score: 'Pendiente de marcador',
  cancelled: 'Cancelados',
}

function outcomeText(
  match: MatchRow,
  myGroupPlayerId: string,
  resultType: MatchResultType | null,
): string {
  if (importResultTypeBothPenalized(match.result_type)) {
    return 'No reportado · penalización'
  }
  if (importResultTypeIsRetiredDraw(match.result_type)) return 'Empate por retiro'
  if (match.winner_id == null) return '---'
  const walkoverLike = importResultTypeUsesDefaultPoints(resultType)
  const w = getMatchOutcome(match, myGroupPlayerId)
  if (walkoverLike) {
    if (w === 'win') return 'Ganaste (W.O./DEF)'
    if (w === 'loss') return 'Perdiste (W.O./DEF)'
  }
  if (resultType === 'retired') {
    if (w === 'win') return 'Ganaste (retiro)'
    if (w === 'loss') return 'Perdiste (retiro)'
  }
  if (w === 'win') return 'Ganaste'
  if (w === 'loss') return 'Perdiste'
  return '—'
}

function signed(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

function pointsLabel(points: number) {
  const sign = points >= 0 ? '+' : ''
  return `${sign}${points} ${Math.abs(points) === 1 ? 'pt' : 'pts'}`
}

function matchTimelineTs(m: MatchRow): number {
  const iso = m.score_submitted_at ?? m.updated_at ?? m.created_at
  return new Date(iso).getTime()
}

function sortRowsDesc(rows: MatchRow[]): MatchRow[] {
  return [...rows].sort((a, b) => matchTimelineTs(b) - matchTimelineTs(a))
}

function groupMatchesByStatusForHistory(matches: MatchRow[]): Map<MatchStatus, MatchRow[]> {
  const map = new Map<MatchStatus, MatchRow[]>()
  for (const s of HISTORY_SECTION_ORDER) map.set(s, [])
  for (const m of matches) {
    const list = map.get(m.status)
    if (list) list.push(m)
  }
  return map
}

type Props = {
  matches: MatchRow[]
  players: GroupPlayerContact[]
  myGroupPlayerId: string
  rules: Pick<
    TournamentRules,
    'points_per_win' | 'points_per_loss' | 'points_default_win' | 'points_default_loss'
  >
  className?: string
  /** Identificadores estables para anclas / pruebas (por defecto: historial del jugador). */
  sectionId?: string
  sectionName?: string
}

export function MatchHistoryCard({
  matches,
  players,
  myGroupPlayerId,
  rules,
  className,
  sectionId = 'player-section-history',
  sectionName = 'player-section-history',
}: Props) {
  const byStatus = groupMatchesByStatusForHistory(matches)

  const renderRow = (m: MatchRow) => {
    const rival = getOpponentInMatch(m, myGroupPlayerId, players)
    const label = getPlayerPerspectiveScore(m, myGroupPlayerId)
    const official =
      (m.status === 'closed' || m.status === 'validated') &&
      (m.winner_id != null ||
        importResultTypeBothPenalized(m.result_type) ||
        importResultTypeIsRetiredDraw(m.result_type))
    const cancelled = m.status === 'cancelled'
    const pts = official ? getPointsForPlayerInMatch(m, myGroupPlayerId, rules) : null
    const gamesDiff = official ? calculateMatchGamesDifference(myGroupPlayerId, m) : null
    const out = outcomeText(m, myGroupPlayerId, m.result_type)
    const when = new Date(m.score_submitted_at ?? m.updated_at)
    const whenStr = Number.isNaN(when.getTime())
      ? '—'
      : new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(when)
    const tone = matchStatusToneClasses[m.status]
    const statusShort = matchStatusLabels[m.status]

    return (
      <li
        key={m.id}
        className="rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-white to-[#F8FAFC] p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex max-w-full items-center">
              <PlayerNameWithPhoneCopy
                name={rival?.display_name ?? 'Rival'}
                phone={rival?.phone}
                prefix="vs."
                nameClassName="text-sm font-bold text-[#102A43]"
              />
            </div>
            <p className="mt-1 font-mono text-lg font-bold tracking-tight text-[#102A43]">{label}</p>
            <p className="mt-1 text-sm font-medium text-[#64748B]">
              {cancelled ? 'Partido cancelado' : official ? out : 'En proceso'}
            </p>
          </div>
          <span
            className={cn(
              'w-fit rounded-full border px-2.5 py-1 text-xs font-semibold',
              tone,
            )}
          >
            {statusShort}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-[#F6F3EE]/70 px-2 py-2">
            <p className="font-medium text-[#64748B]">Puntos</p>
            <p className="mt-0.5 font-bold text-[#1F5A4C]">{pts != null ? pointsLabel(pts) : '—'}</p>
          </div>
          <div className="rounded-xl bg-[#F6F3EE]/70 px-2 py-2">
            <p className="font-medium text-[#64748B]">Dif. juegos</p>
            <p
              className={cn(
                'mt-0.5 font-bold',
                gamesDiff == null ? 'text-[#64748B]' : gamesDiff < 0 ? 'text-red-600' : 'text-emerald-700',
              )}
            >
              {gamesDiff != null ? signed(gamesDiff) : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-[#F6F3EE]/70 px-2 py-2">
            <p className="font-medium text-[#64748B]">Registro</p>
            <p className="mt-0.5 font-bold text-[#102A43]">{whenStr}</p>
          </div>
        </div>
      </li>
    )
  }

  const hasAny = matches.length > 0

  return (
    <section
      id={sectionId}
      data-name={sectionName}
      className={cn(
        'overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-sm',
        className,
      )}
    >
      <div className="border-b border-[#E2E8F0] bg-gradient-to-r from-white to-[#F6F3EE]/80 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#F6F3EE] text-[#1F5A4C]">
            <History className="size-4" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-[#102A43]">Historial</h2>
            <p className="text-sm text-[#64748B]">
              Todos tus partidos en este torneo, ordenados por estado y fecha
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-6 p-3 sm:p-4">
        {!hasAny ? (
          <p className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F6F3EE]/50 px-4 py-8 text-center text-sm text-[#64748B]">
            Aún no hay partidos registrados para ti en este grupo.
          </p>
        ) : (
          HISTORY_SECTION_ORDER.map((status) => {
            const rows = sortRowsDesc(byStatus.get(status) ?? [])
            if (rows.length === 0) return null
            const heading = SECTION_HEADING[status] ?? matchStatusLabels[status]
            return (
              <div key={status} className="space-y-3">
                <h3 className="text-xs font-bold tracking-wide text-[#64748B] uppercase">{heading}</h3>
                <ul className="space-y-3">{rows.map((m) => renderRow(m))}</ul>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

