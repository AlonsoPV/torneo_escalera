import type { SimMatch } from '@/types/tournament'
import { idsEqual } from '@/utils/tournamentInvert'

export type MatrixCellKind =
  | 'diagonal'
  | 'empty'
  | 'win'
  | 'loss'
  | 'default-win'
  | 'default-loss'

export function getMatrixCellKind(
  rowId: string,
  colId: string,
  match: SimMatch | undefined,
): MatrixCellKind {
  if (rowId === colId) return 'diagonal'
  if (!match) return 'empty'
  if (match.resultType === 'default') {
    const rowIsA = idsEqual(rowId, match.playerAId)
    const winnerIsA = match.defaultWinner === 'a'
    const rowWon = rowIsA ? winnerIsA : !winnerIsA
    return rowWon ? 'default-win' : 'default-loss'
  }
  const rowWon = idsEqual(match.winnerId, rowId)
  return rowWon ? 'win' : 'loss'
}
