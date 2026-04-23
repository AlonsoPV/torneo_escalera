import { supabase } from '@/lib/supabase'
import type { GroupPlayer, Json, MatchRow, MatchStatus, ScoreSet } from '@/types/database'
import { getTournamentRules } from '@/services/tournaments'
import { orderPlayersCanonically, pairKey } from '@/utils/matches'
import {
  computeWinnerGroupPlayerId,
  validateScoreAgainstRules,
} from '@/utils/score'

export async function listMatchesForGroup(groupId: string): Promise<MatchRow[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('group_id', groupId)
  if (error) throw error
  return (data ?? []) as MatchRow[]
}

function mapPostgresError(e: { message: string; code?: string; details?: string }): string {
  const msg = e.message
  if (msg.includes('El jugador ya está inscrito')) return msg
  if (msg.includes('El grupo alcanzó el máximo')) return msg
  if (e.code === '23505' || e.code === 'P0001') return msg
  return msg
}

export async function saveMatchScore(input: {
  match: MatchRow
  sets: ScoreSet[]
  actorUserId: string
  isAdmin: boolean
}): Promise<void> {
  const rules = await getTournamentRules(input.match.tournament_id)
  if (!rules) throw new Error('No se encontraron reglas del torneo.')

  const issues = validateScoreAgainstRules(input.sets, rules)
  if (issues.length > 0) {
    throw new Error(issues.map((i) => i.message).join(' '))
  }

  const winnerId = computeWinnerGroupPlayerId(
    input.sets,
    input.match.player_a_id,
    input.match.player_b_id,
    rules.best_of_sets,
  )
  if (!winnerId) throw new Error('No se pudo determinar un ganador.')

  const pScore = input.sets as unknown as Json

  if (input.isAdmin) {
    let nextStatus: MatchStatus
    if (input.match.status === 'result_submitted') {
      nextStatus = 'confirmed'
    } else if (input.match.status === 'confirmed' || input.match.status === 'corrected') {
      nextStatus = 'corrected'
    } else {
      nextStatus = 'confirmed'
    }
    const { error } = await supabase.rpc('admin_set_match_result', {
      p_match_id: input.match.id,
      p_score: pScore,
      p_winner_id: winnerId,
      p_status: nextStatus,
      p_result_type: 'normal',
    })
    if (error) throw new Error(mapPostgresError(error))
    return
  }

  const { error } = await supabase.rpc('submit_player_match_result', {
    p_match_id: input.match.id,
    p_score: pScore,
    p_result_type: 'normal',
    p_winner_group_player_id: winnerId,
  })
  if (error) throw new Error(mapPostgresError(error))
}

export type GenerateRrMode = 'fill' | 'reset'

export async function generateRoundRobinMatches(input: {
  tournamentId: string
  groupId: string
  players: GroupPlayer[]
  createdBy: string | null
  mode?: GenerateRrMode
}): Promise<void> {
  const { tournamentId, groupId, players, createdBy, mode = 'fill' } = input
  if (players.length < 2) return
  if (players.length > 5) {
    throw new Error('Máximo 5 jugadores por grupo para round robin (reglas del producto).')
  }

  if (mode === 'reset') {
    const { error: delError } = await supabase
      .from('matches')
      .delete()
      .eq('group_id', groupId)
    if (delError) throw delError
  }

  const existing = mode === 'fill' ? await listMatchesForGroup(groupId) : []
  const existingKeys = new Set(existing.map((m) => pairKey(m.player_a_id, m.player_b_id)))

  const rows: {
    tournament_id: string
    group_id: string
    player_a_id: string
    player_b_id: string
    player_a_user_id: string
    player_b_user_id: string
    created_by: string | null
  }[] = []

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const c = orderPlayersCanonically(players[i], players[j])
      const key = pairKey(players[i].id, players[j].id)
      if (mode === 'fill' && existingKeys.has(key)) continue
      rows.push({
        tournament_id: tournamentId,
        group_id: groupId,
        player_a_id: c.playerA.id,
        player_b_id: c.playerB.id,
        player_a_user_id: c.playerAUserId,
        player_b_user_id: c.playerBUserId,
        created_by: createdBy,
      })
    }
  }

  if (rows.length === 0) return
  const { error } = await supabase.from('matches').insert(rows)
  if (error) throw new Error(mapPostgresError(error))
}

export type MatchSchedulePatch = {
  scheduled_date?: string | null
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
  location?: string | null
}

/**
 * Agendar partido. Si hay agenda, el estado pasa a `scheduled` salvo que ya tenga
 * resultado o esté en flujo de confirmación.
 */
export async function updateMatchSchedule(
  matchId: string,
  patch: MatchSchedulePatch,
  actorId: string,
): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from('matches')
    .select('id, status')
    .eq('id', matchId)
    .single()
  if (fetchError) throw fetchError
  const hasSomeSchedule = Boolean(
    patch.scheduled_date ?? patch.scheduled_start_at ?? patch.scheduled_end_at,
  )
  const keepStatus = [
    'result_submitted',
    'confirmed',
    'corrected',
    'cancelled',
  ].includes(row.status)
  const nextStatus: MatchStatus | undefined = keepStatus
    ? (row.status as MatchStatus)
    : hasSomeSchedule
      ? 'scheduled'
      : undefined
  const { error } = await supabase
    .from('matches')
    .update({
      ...patch,
      ...(nextStatus ? { status: nextStatus } : {}),
      updated_by: actorId,
    })
    .eq('id', matchId)
  if (error) throw error
}

export function matchMapByPair(matches: MatchRow[]): Map<string, MatchRow> {
  const map = new Map<string, MatchRow>()
  for (const m of matches) {
    const key =
      m.player_a_id < m.player_b_id
        ? `${m.player_a_id}:${m.player_b_id}`
        : `${m.player_b_id}:${m.player_a_id}`
    map.set(key, m)
  }
  return map
}
