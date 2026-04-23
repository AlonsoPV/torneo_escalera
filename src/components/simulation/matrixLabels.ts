import type { SimMatch } from '@/types/tournament'
import { formatScoreCompact } from '@/utils/score'
import { idsEqual, perspectiveScoreSetsForRowPlayer } from '@/utils/tournamentInvert'

/** Etiqueta y título accesible para la celda (perspectiva fila: primero games del jugador de la fila). */
export function getCellLabelAndTitle(rowId: string, match: SimMatch | undefined): {
  label: string
  title: string
} {
  if (!match) {
    return { label: '—', title: 'Sin resultado' }
  }

  if (match.winnerId == null) {
    return { label: '—', title: 'Por jugar' }
  }

  if (match.resultType === 'default') {
    const rowIsA = idsEqual(rowId, match.playerAId)
    const winnerIsA = match.defaultWinner === 'a'
    const rowWon = rowIsA ? winnerIsA : !winnerIsA
    const short = rowWon ? 'Victoria por defecto' : 'Derrota por defecto'
    return {
      label: rowWon ? 'DEF+' : 'DEF−',
      title: `${short} · mismo partido (sin duplicar en datos)`,
    }
  }

  const sets = match.score ?? []
  const perspective = perspectiveScoreSetsForRowPlayer(rowId, match)
  const label = formatScoreCompact(perspective)
  const canonical = formatScoreCompact(sets)
  return {
    label,
    title: `Tu fila primero: ${label} · almacenado (A vs B): ${canonical}`,
  }
}
