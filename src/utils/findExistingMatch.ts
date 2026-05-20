import type { MatchRow } from '@/types/database'

import { pairKey } from '@/utils/matches'

/**
 * Encuentra la fila `matches` del grupo para la pareja (A,B), sin importar el orden canónico guardado en BD.
 */
export function findExistingMatchForGroupPair(
  matches: Pick<MatchRow, 'id' | 'group_id' | 'player_a_id' | 'player_b_id'>[],
  groupId: string,
  groupPlayerIdA: string,
  groupPlayerIdB: string,
): Pick<MatchRow, 'id' | 'group_id' | 'player_a_id' | 'player_b_id'> | null {
  const want = pairKey(groupPlayerIdA, groupPlayerIdB)
  for (const m of matches) {
    if (m.group_id !== groupId) continue
    if (pairKey(m.player_a_id, m.player_b_id) === want) return m
  }
  return null
}
