import { supabase } from '@/lib/supabase'
import type { GroupPlayer, Json, MatchRow, MatchStatus, ScorePayload, ScoreSet } from '@/types/database'
import { getTournamentRules } from '@/services/tournaments'
import { orderPlayersCanonically, pairKey } from '@/utils/matches'
import {
  computeWinnerGroupPlayerId,
  scorePayloadToSets,
  validateBestOf3Score,
  validateLongSetScore,
  validateScoreWithRules,
  validateSuddenDeathScore,
  winnerSideToGroupPlayerId,
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
  sets?: ScoreSet[]
  scorePayload?: ScorePayload
  actorUserId: string
  isAdmin: boolean
  adminStatus?: MatchStatus
}): Promise<void> {
  const rules = await getTournamentRules(input.match.tournament_id)
  if (!rules) throw new Error('No se encontraron reglas del torneo.')

  const fallbackWinner = computeWinnerGroupPlayerId(
    input.sets ?? [],
    input.match.player_a_id,
    input.match.player_b_id,
    rules.best_of_sets,
  )
  const payload: ScorePayload = input.scorePayload ?? (
    input.match.game_type === 'sudden_death'
      ? {
          game_type: 'sudden_death',
          score_json: null,
          winner: input.match.winner_id === input.match.player_b_id ? 'b' : 'a',
        }
      : input.match.game_type === 'long_set'
        ? {
            game_type: 'long_set',
            score_json: [input.sets?.[0] ?? { a: 0, b: 0 }],
            winner: (input.sets?.[0]?.b ?? 0) > (input.sets?.[0]?.a ?? 0) ? 'b' : 'a',
          }
        : {
            game_type: 'best_of_3',
            score_json: input.sets ?? [],
            winner: fallbackWinner === input.match.player_b_id ? 'b' : 'a',
          }
  )

  const sets = scorePayloadToSets(payload)
  let winnerId: string | null = null

  if (payload.game_type === 'best_of_3') {
    const validation = validateBestOf3Score(payload.score_json)
    if (!validation.ok || !validation.winner) throw new Error(validation.errors.join(' '))
    const rulesValidation = validateScoreWithRules(payload.score_json, rules)
    if (!rulesValidation.ok) throw new Error(rulesValidation.errors.join(' '))
    winnerId = winnerSideToGroupPlayerId(validation.winner, input.match)
  } else if (payload.game_type === 'long_set') {
    const validation = validateLongSetScore(payload.score_json[0])
    if (!validation.ok || !validation.winner) throw new Error(validation.errors.join(' '))
    winnerId = winnerSideToGroupPlayerId(validation.winner, input.match)
  } else {
    const validation = validateSuddenDeathScore({ game_type: payload.game_type, winner: payload.winner })
    if (!validation.ok || !validation.winner) throw new Error(validation.errors.join(' '))
    winnerId = winnerSideToGroupPlayerId(validation.winner, input.match)
  }

  if (!winnerId) throw new Error('No se pudo determinar un ganador.')

  const pScore = (payload.game_type === 'sudden_death' ? null : sets) as unknown as Json

  if (input.isAdmin) {
    const { error } = await supabase.rpc('admin_set_match_result', {
      p_match_id: input.match.id,
      p_score: pScore,
      p_winner_id: winnerId,
      p_status: input.adminStatus ?? 'closed',
      p_result_type: 'normal',
      p_game_type: payload.game_type,
    })
    if (error) throw new Error(mapPostgresError(error))
    return
  }

  const { error } = await supabase.rpc('submit_player_match_result', {
    p_match_id: input.match.id,
    p_score: pScore,
    p_result_type: 'normal',
    p_winner_group_player_id: winnerId,
    p_game_type: payload.game_type,
  })
  if (error) throw new Error(mapPostgresError(error))
}

/**
 * Jugador A: envía marcador → RPC `submit_player_match_result` deja el partido en `score_submitted`.
 * Jugador B acepta con `respondOpponentMatchScore` → `player_confirmed`. El staff cierra → `closed`.
 */
export async function submitPlayerScore(input: {
  match: MatchRow
  sets?: ScoreSet[]
  scorePayload?: ScorePayload
  actorUserId: string
}): Promise<void> {
  return saveMatchScore({ ...input, isAdmin: false })
}

export async function submitMatchScore(
  matchId: string,
  playerId: string,
  scorePayload: ScoreSet[] | ScorePayload,
): Promise<void> {
  const { data, error } = await supabase.from('matches').select('*').eq('id', matchId).single()
  if (error) throw new Error(mapPostgresError(error))
  return Array.isArray(scorePayload)
    ? submitPlayerScore({ match: data as MatchRow, sets: scorePayload, actorUserId: playerId })
    : submitPlayerScore({ match: data as MatchRow, scorePayload, actorUserId: playerId })
}

export async function correctAdminScore(input: {
  match: MatchRow
  sets: ScoreSet[]
  actorUserId: string
  closeAfter?: boolean
}): Promise<void> {
  return saveMatchScore({
    ...input,
    isAdmin: true,
    adminStatus: input.closeAfter === false ? 'player_confirmed' : 'closed',
  })
}

export async function closeAdminScore(input: {
  match: MatchRow
  actorUserId: string
}): Promise<void> {
  if (input.match.game_type === 'sudden_death') {
    if (!input.match.winner_id) throw new Error('El partido no tiene ganador para cerrar.')
    return saveMatchScore({
      match: input.match,
      scorePayload: {
        game_type: 'sudden_death',
        score_json: null,
        winner: input.match.winner_id === input.match.player_b_id ? 'b' : 'a',
      },
      actorUserId: input.actorUserId,
      isAdmin: true,
    })
  }
  if (!input.match.score_raw?.length) throw new Error('El partido no tiene marcador para cerrar.')
  return saveMatchScore({
    match: input.match,
    sets: input.match.score_raw,
    actorUserId: input.actorUserId,
    isAdmin: true,
  })
}

export async function adminCloseMatch(matchId: string, adminId: string): Promise<void> {
  const { data, error } = await supabase.from('matches').select('*').eq('id', matchId).single()
  if (error) throw new Error(mapPostgresError(error))
  return closeAdminScore({ match: data as MatchRow, actorUserId: adminId })
}

export async function cancelMatch(matchId: string, actorUserId: string): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'cancelled', updated_by: actorUserId })
    .eq('id', matchId)
  if (error) throw new Error(mapPostgresError(error))
}

export async function respondOpponentMatchScore(input: {
  matchId: string
  accept: boolean
  disputeReason?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('opponent_respond_match_score', {
    p_match_id: input.matchId,
    p_accept: input.accept,
    p_dispute_reason: input.disputeReason ?? null,
  })
  if (error) throw new Error(mapPostgresError(error))
}

export async function acceptPlayerScore(matchId: string): Promise<void> {
  return respondOpponentMatchScore({ matchId, accept: true })
}

export async function acceptMatchScore(matchId: string, _playerId?: string): Promise<void> {
  return acceptPlayerScore(matchId)
}

export async function rejectPlayerScore(input: {
  matchId: string
  disputeReason: string
}): Promise<void> {
  return respondOpponentMatchScore({
    matchId: input.matchId,
    accept: false,
    disputeReason: input.disputeReason,
  })
}

export async function rejectMatchScore(matchId: string, _playerId: string | undefined, reason: string): Promise<void> {
  return rejectPlayerScore({ matchId, disputeReason: reason })
}

export async function adminReopenMatchResult(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reopen_match_result', {
    p_match_id: matchId,
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
    status: MatchStatus
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
        status: 'pending_score',
      })
    }
  }

  if (rows.length === 0) return
  const { error } = await supabase.from('matches').insert(rows)
  if (error) throw new Error(mapPostgresError(error))
}

export async function generateMatchesForGroupIfComplete(input: {
  groupId: string
  createdBy: string | null
}): Promise<{ generated: boolean; reason?: 'incomplete' | 'exists'; expectedPlayers: number; playerCount: number }> {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, tournament_id, max_players')
    .eq('id', input.groupId)
    .single()
  if (groupError) throw groupError

  const { data: playersData, error: playersError } = await supabase
    .from('group_players')
    .select('*')
    .eq('group_id', input.groupId)
    .order('seed_order', { ascending: true })
    .order('id', { ascending: true })
  if (playersError) throw playersError

  const players = (playersData ?? []) as GroupPlayer[]
  const expectedPlayers = group.max_players ?? 5
  if (players.length < expectedPlayers) {
    return { generated: false, reason: 'incomplete', expectedPlayers, playerCount: players.length }
  }

  const existing = await listMatchesForGroup(input.groupId)
  if (existing.length > 0) {
    return { generated: false, reason: 'exists', expectedPlayers, playerCount: players.length }
  }

  await generateRoundRobinMatches({
    tournamentId: group.tournament_id,
    groupId: input.groupId,
    players,
    createdBy: input.createdBy,
    mode: 'fill',
  })

  return { generated: true, expectedPlayers, playerCount: players.length }
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
