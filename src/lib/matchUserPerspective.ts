import type { GroupPlayer, MatchRow, ScoreSet } from '@/types/database'
import { formatScoreCompact, invertScoreSets } from '@/utils/score'

/**
 * Resuelve el `group_players.id` del usuario autenticado en este cruce.
 * Prioriza columnas del match; si faltan user ids en la fila, usa la lista de jugadores del grupo.
 */
export function resolveViewerGroupPlayerId(
  match: MatchRow,
  currentUserId: string | null | undefined,
  players?: GroupPlayer[],
): string | null {
  if (!currentUserId) return null
  if (match.player_a_user_id === currentUserId) return match.player_a_id
  if (match.player_b_user_id === currentUserId) return match.player_b_id
  if (players?.length) {
    const gp = players.find((p) => p.user_id === currentUserId)
    const pid = gp?.id
    if (pid && (pid === match.player_a_id || pid === match.player_b_id)) return pid
  }
  return null
}

/** Marcador en perspectiva del jugador que mira: primer número = sus games/puntos. */
export function getViewerPerspectiveScoreSets(match: MatchRow, viewerGroupPlayerId: string): ScoreSet[] | null {
  if (!match.score_raw?.length) return null
  if (match.player_a_id === viewerGroupPlayerId) return match.score_raw
  if (match.player_b_id === viewerGroupPlayerId) return invertScoreSets(match.score_raw)
  return null
}

/**
 * @deprecated Usa `getViewerPerspectiveScoreSets(match, viewerGroupPlayerId)` o
 * `resolveViewerGroupPlayerId` + esa función. Mantenido por compatibilidad con código que solo tiene userId.
 */
export function getPlayerPerspectiveScoreSetsForUserId(
  match: MatchRow,
  userId: string,
  players?: GroupPlayer[],
): ScoreSet[] | null {
  const gid = resolveViewerGroupPlayerId(match, userId, players)
  return gid ? getViewerPerspectiveScoreSets(match, gid) : null
}

function suddenDeathLabel(match: MatchRow, viewerGroupPlayerId: string): string {
  if (!match.winner_id) return 'Muerte súbita'
  const youWon = match.winner_id === viewerGroupPlayerId
  return youWon ? 'Ganaste (muerte súbita)' : 'Ganó tu rival (muerte súbita)'
}

/** Texto compacto del marcador: siempre con el autor mirando como referencia (primer número = tú). */
export function getPlayerPerspectiveScore(match: MatchRow, viewerGroupPlayerId: string): string {
  if (match.game_type === 'sudden_death') {
    const raw = match.score_raw ?? []
    if (raw.length >= 3) {
      const perspectiveSets =
        viewerGroupPlayerId === match.player_b_id ? invertScoreSets(raw) : raw
      return formatScoreCompact(perspectiveSets)
    }
    return suddenDeathLabel(match, viewerGroupPlayerId)
  }
  const sets = getViewerPerspectiveScoreSets(match, viewerGroupPlayerId)
  if (!sets?.length) return '—'
  return formatScoreCompact(sets)
}
