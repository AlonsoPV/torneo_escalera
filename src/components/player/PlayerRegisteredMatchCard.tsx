import { Button } from '@/components/ui/button'
import { PlayerMatchFeedLayout } from '@/components/player/PlayerMatchFeedLayout'
import {
  calculateMatchGamesDifference,
  getMatchOutcome,
  getPointsForPlayerInMatch,
} from '@/lib/playerDashboard'
import { buildPlayerLogEntries, gameTypeLabel } from '@/lib/playerMatchFeed'
import {
  importResultTypeBothPenalized,
  importResultTypeIsRetiredDraw,
  importResultTypeUsesDefaultPoints,
} from '@/lib/matchResultSemantics'
import type { GroupPlayer, MatchResultType, MatchRow, TournamentRules } from '@/types/database'

function outcomeLine(match: MatchRow, myGroupPlayerId: string, resultType: MatchResultType | null): string {
  if (importResultTypeBothPenalized(match.result_type)) return 'No reportado · penalización'
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

function signed(n: number) {
  if (n > 0) return `+${n}`
  return String(n)
}

function pointsPhrase(points: number) {
  const sign = points >= 0 ? '+' : ''
  return `${sign}${points} ${Math.abs(points) === 1 ? 'pt' : 'pts'}`
}

export function PlayerRegisteredMatchCard({
  match,
  groupName,
  myGroupPlayerId,
  players,
  rules,
  viewerUserId,
  onRefute,
}: {
  match: MatchRow
  groupName: string
  myGroupPlayerId: string
  players: GroupPlayer[]
  rules: TournamentRules
  viewerUserId: string
  onRefute?: () => void
}) {
  const officialCounted =
    (match.status === 'closed' || match.status === 'validated') && (match.winner_id != null || importResultTypeBothPenalized(match.result_type) || importResultTypeIsRetiredDraw(match.result_type))
  const pts = officialCounted ? getPointsForPlayerInMatch(match, myGroupPlayerId, rules) : null
  const gamesDiff = officialCounted ? calculateMatchGamesDifference(myGroupPlayerId, match) : null
  const outcome = officialCounted ? outcomeLine(match, myGroupPlayerId, match.result_type) : null
  const impact =
    pts != null && gamesDiff != null ? `${pointsPhrase(pts)} · Juegos ${signed(gamesDiff)}` : null

  const logEntries = buildPlayerLogEntries(match, players, viewerUserId, {
    outcome,
    impact,
  })

  const refuteFooter = onRefute ? (
    <Button type="button" variant="outline" className="h-9 w-full sm:w-auto" onClick={onRefute}>
      Refutar resultado
    </Button>
  ) : undefined

  return (
    <PlayerMatchFeedLayout
      match={match}
      players={players}
      userId={viewerUserId}
      groupName={groupName}
      metaLabel={gameTypeLabel(match.game_type)}
      logEntries={logEntries}
      footer={refuteFooter}
      id={`player-match-registered-${match.id}`}
    />
  )
}

