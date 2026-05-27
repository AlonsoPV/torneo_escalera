import type { GroupPlayer, MatchRow } from '@/types/database'

export function resolveMatchWinnerLoser(
  match: MatchRow,
  players: GroupPlayer[],
): { winnerName: string | null; loserName: string | null } {
  const playerA = players.find((p) => p.id === match.player_a_id)
  const playerB = players.find((p) => p.id === match.player_b_id)
  const winner = match.winner_id ? players.find((p) => p.id === match.winner_id) : null

  if (!winner) return { winnerName: null, loserName: null }

  const loser =
    match.winner_id === match.player_a_id ? playerB : match.winner_id === match.player_b_id ? playerA : null

  return {
    winnerName: winner.display_name,
    loserName: loser?.display_name ?? null,
  }
}

export function resolveDisputerLabel(
  match: MatchRow,
  players: GroupPlayer[],
  viewerUserId?: string,
): string | null {
  if (!match.disputed_by) return null
  if (viewerUserId && match.disputed_by === viewerUserId) return 'Tú'
  const disputer = players.find((p) => p.user_id === match.disputed_by)
  return disputer?.display_name ?? 'Jugador'
}
