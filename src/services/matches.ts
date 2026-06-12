import { supabase } from '@/lib/supabase'
import { IMPORT_ADMIN_PENALTY_SCORE } from '@/lib/matchResultSemantics'
import { isPlayerSubmitPerfEnabled } from '@/lib/playerSubmitPerf'
import type {
  Database,
  GroupPlayer,
  Json,
  MatchRow,
  MatchStatus,
  ScorePayload,
  ScoreSet,
  ScoreWinnerSide,
  TournamentRules,
} from '@/types/database'
import { getTournamentRules } from '@/services/tournaments'
import { orderPlayersCanonically, pairKey } from '@/utils/matches'
import {
  computeWinnerGroupPlayerId,
  getSuddenDeathWinnerSide,
  scorePayloadToSets,
  validateIncompleteBestOf3Score,
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

export type PreparedPlayerScoreSubmission = {
  winnerId: string | null
  payload: ScorePayload
  pScoreJson: Json
  resultType: NonNullable<ScorePayload['result_type']>
}

/**
 * Validación + payload RPC para marcador (sincrónico). Usado por saveMatchScore y por la UI para parchear cache sin otro round-trip.
 */
export function preparePlayerScoreSubmissionSync(input: {
  match: MatchRow
  sets?: ScoreSet[]
  scorePayload?: ScorePayload
  rules: TournamentRules
}): PreparedPlayerScoreSubmission {
  const { match, sets: inputSets, scorePayload: inputPayload, rules } = input

  const fallbackWinner = computeWinnerGroupPlayerId(
    inputSets ?? [],
    match.player_a_id,
    match.player_b_id,
    rules.best_of_sets,
  )
  const payload: ScorePayload =
    inputPayload ??
    (() => {
      if (match.game_type === 'sudden_death') {
        const three =
          inputSets?.length === 3
            ? inputSets
            : match.score_raw?.length === 3
              ? match.score_raw
              : null
        const winnerFromThree = three ? getSuddenDeathWinnerSide(three) : null
        const winnerSide: ScoreWinnerSide | null =
          winnerFromThree ??
          (match.winner_id === match.player_b_id ? 'b' : match.winner_id === match.player_a_id ? 'a' : null)
        if (!winnerSide) {
          throw new Error('No se pudo determinar el ganador para muerte súbita.')
        }
        return {
          game_type: 'sudden_death',
          score_json: three,
          winner: winnerSide,
        }
      }
      if (match.game_type === 'long_set') {
        return {
          game_type: 'long_set',
          score_json: [inputSets?.[0] ?? { a: 0, b: 0 }],
          winner: (inputSets?.[0]?.b ?? 0) > (inputSets?.[0]?.a ?? 0) ? 'b' : 'a',
        }
      }
      const normalizedGameType =
        match.game_type === 'best_of_3_short_tiebreak' ? 'best_of_3_short_tiebreak' : 'best_of_3'
      return {
        game_type: normalizedGameType,
        score_json: inputSets ?? [],
        winner: fallbackWinner === match.player_b_id ? 'b' : 'a',
      }
    })()

  const scoreSets = scorePayloadToSets(payload)
  let winnerId: string | null = null
  const resultType = payload.result_type ?? 'normal'

  if (resultType !== 'normal') {
    if (payload.game_type !== 'best_of_3') {
      throw new Error('El retiro solo aplica para partidos 2 de 3 sets.')
    }
    if (resultType === 'not_reported') {
      return { winnerId: null, payload, pScoreJson: IMPORT_ADMIN_PENALTY_SCORE as unknown as Json, resultType }
    }
    const validation = validateIncompleteBestOf3Score(payload.score_json ?? [])
    if (!validation.ok) throw new Error(validation.errors.join(' '))
    if (resultType === 'retired') {
      if (!validation.winnerByGames) {
        throw new Error('El marcador esta empatado en games. Usa la opcion de empate por retiro.')
      }
      winnerId = winnerSideToGroupPlayerId(validation.winnerByGames, match)
      return { winnerId, payload, pScoreJson: scoreSets as unknown as Json, resultType }
    }
    if (resultType === 'retired_draw') {
      if (validation.games.a !== validation.games.b) {
        throw new Error('Para empate por retiro, ambos jugadores deben tener la misma cantidad de games.')
      }
      return { winnerId: null, payload, pScoreJson: scoreSets as unknown as Json, resultType }
    }
    throw new Error('Tipo de resultado no soportado para envio de jugador.')
  }

  if (payload.game_type === 'best_of_3') {
    const validation = validateBestOf3Score(payload.score_json ?? [], {
      gamesPerSet: rules.games_per_set ?? rules.set_points ?? 6,
    })
    if (!validation.ok || !validation.winner) throw new Error(validation.errors.join(' '))
    const rulesValidation = validateScoreWithRules(payload.score_json ?? [], rules)
    if (!rulesValidation.ok) throw new Error(rulesValidation.errors.join(' '))
    winnerId = winnerSideToGroupPlayerId(validation.winner, match)
  } else if (payload.game_type === 'best_of_3_short_tiebreak') {
    const validation = validateBestOf3Score(payload.score_json, {
      allowShortDecisiveSet: true,
      shortDecisiveSetNoMinDifference: true,
      gamesPerSet: rules.games_per_set ?? rules.set_points ?? 6,
    })
    if (!validation.ok || !validation.winner) throw new Error(validation.errors.join(' '))
    const rulesValidation = validateScoreWithRules(payload.score_json, rules)
    if (!rulesValidation.ok) throw new Error(rulesValidation.errors.join(' '))
    winnerId = winnerSideToGroupPlayerId(validation.winner, match)
  } else if (payload.game_type === 'long_set') {
    const validation = validateLongSetScore(payload.score_json[0])
    if (!validation.ok || !validation.winner) throw new Error(validation.errors.join(' '))
    winnerId = winnerSideToGroupPlayerId(validation.winner, match)
  } else {
    const validation = validateSuddenDeathScore({
      game_type: payload.game_type,
      score_json: payload.score_json,
      winner: payload.winner,
      rules,
    })
    if (!validation.ok || !validation.winner) throw new Error(validation.errors.join(' '))
    winnerId = winnerSideToGroupPlayerId(validation.winner, match)
  }

  const pScore =
    payload.game_type === 'sudden_death' ? (scoreSets.length === 3 ? scoreSets : null) : scoreSets
  const pScoreJson = pScore as unknown as Json

  return { winnerId, payload, pScoreJson, resultType }
}

function parseMatchRowFromRpc(data: unknown): MatchRow | undefined {
  if (data == null || typeof data !== 'object') return undefined
  return data as MatchRow
}

/**
 * Destino de estado al guardar como admin.
 * Desde disputa: `explicit === 'score_disputed'` guarda borrador (sigue en revisión); cerrar valida.
 * Enviamos `closed` al RPC: migración 042+ lo convierte en `validated`; en DB anteriores queda `closed` (oficial).
 */
export function inferAdminSaveTargetStatus(match: MatchRow, explicit?: MatchStatus): MatchStatus {
  if (explicit === 'cancelled') return 'cancelled'
  if (match.status === 'score_disputed') {
    if (explicit === 'score_disputed') return 'score_disputed'
    return 'closed'
  }
  if (explicit != null) return explicit
  if (match.status === 'closed' || match.status === 'validated' || match.status === 'cancelled')
    return match.status
  return 'closed'
}

export async function saveMatchScore(input: {
  match: MatchRow
  sets?: ScoreSet[]
  scorePayload?: ScorePayload
  actorUserId: string
  isAdmin: boolean
  adminStatus?: MatchStatus
  /** Si viene definido (p. ej. vista jugador), evita getTournamentRules antes del RPC. */
  rules?: TournamentRules | null
}): Promise<MatchRow | undefined> {
  const rules =
    input.rules ?? (await getTournamentRules(input.match.tournament_id))
  if (!rules) throw new Error('No se encontraron reglas del torneo.')

  const { winnerId, payload, pScoreJson, resultType } = preparePlayerScoreSubmissionSync({
    match: input.match,
    sets: input.sets,
    scorePayload: input.scorePayload,
    rules,
  })

  if (input.isAdmin) {
    const targetStatus = inferAdminSaveTargetStatus(input.match, input.adminStatus)
    const { error } = await supabase.rpc('admin_set_match_result', {
      p_match_id: input.match.id,
      p_score: pScoreJson,
      p_winner_id: winnerId,
      p_status: targetStatus,
      p_result_type: resultType,
      p_game_type: payload.game_type,
    })
    if (error) throw new Error(mapPostgresError(error))
    return undefined
  }

  const tRpc = isPlayerSubmitPerfEnabled() ? performance.now() : 0
  const { data, error } = await supabase.rpc('submit_player_match_result', {
    p_match_id: input.match.id,
    p_score: pScoreJson,
    p_result_type: resultType,
    p_winner_group_player_id: winnerId,
    p_game_type: payload.game_type,
  })
  if (isPlayerSubmitPerfEnabled()) {
    console.debug(`[perf] submit_player_match_result RPC ${Math.round(performance.now() - tRpc)}ms`)
  }
  if (error) throw new Error(mapPostgresError(error))
  return parseMatchRowFromRpc(data)
}

/**
 * Envío jugador: RPC `submit_player_match_result` → `closed`. Devuelve la fila persistida cuando el servidor la incluye en la respuesta.
 */
export async function submitPlayerScore(input: {
  match: MatchRow
  sets?: ScoreSet[]
  scorePayload?: ScorePayload
  actorUserId: string
  rules?: TournamentRules | null
}): Promise<MatchRow | undefined> {
  return saveMatchScore({ ...input, isAdmin: false })
}

export async function submitMatchScore(
  matchId: string,
  playerId: string,
  scorePayload: ScoreSet[] | ScorePayload,
): Promise<MatchRow | undefined> {
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
}): Promise<MatchRow | undefined> {
  if (input.match.status === 'score_disputed' && input.closeAfter === false) {
    throw new Error('En un partido refutado solo puedes validar o corregir y validar el marcador.')
  }
  const explicit: MatchStatus =
    input.match.status === 'score_disputed' && input.closeAfter === false ? 'score_disputed' : 'closed'
  return saveMatchScore({
    ...input,
    isAdmin: true,
    adminStatus: inferAdminSaveTargetStatus(input.match, explicit),
  })
}

export async function closeAdminScore(input: {
  match: MatchRow
  actorUserId: string
}): Promise<MatchRow | undefined> {
  if (input.match.game_type === 'sudden_death') {
    if (!input.match.winner_id) throw new Error('El partido no tiene ganador para cerrar.')
    return saveMatchScore({
      match: input.match,
      scorePayload: {
        game_type: 'sudden_death',
        score_json:
          input.match.score_raw?.length === 3 ? input.match.score_raw : null,
        winner: input.match.winner_id === input.match.player_b_id ? 'b' : 'a',
      },
      actorUserId: input.actorUserId,
      isAdmin: true,
      adminStatus: inferAdminSaveTargetStatus(input.match, 'closed'),
    })
  }
  if (!input.match.score_raw?.length) throw new Error('El partido no tiene marcador para cerrar.')
  return saveMatchScore({
    match: input.match,
    sets: input.match.score_raw,
    actorUserId: input.actorUserId,
    isAdmin: true,
    adminStatus: inferAdminSaveTargetStatus(input.match, 'closed'),
  })
}

export async function adminCloseMatch(matchId: string, adminId: string): Promise<void> {
  const { data, error } = await supabase.from('matches').select('*').eq('id', matchId).single()
  if (error) throw new Error(mapPostgresError(error))
  await closeAdminScore({ match: data as MatchRow, actorUserId: adminId })
}

export async function cancelMatch(matchId: string, actorUserId: string): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'cancelled', updated_by: actorUserId })
    .eq('id', matchId)
  if (error) throw new Error(mapPostgresError(error))
}

/** Confirma como válido el marcador registrado tras disputa (sin cambiar sets). */
export async function adminValidateDisputedWithoutChanges(match: MatchRow): Promise<void> {
  const { data, error: fetchError } = await supabase.from('matches').select('*').eq('id', match.id).single()
  if (fetchError) throw new Error(mapPostgresError(fetchError))
  const fresh = data as MatchRow

  if (fresh.status !== 'score_disputed') {
    throw new Error('Solo aplica a partidos pendientes de revisión administrativa.')
  }
  if (!fresh.winner_id) throw new Error('Falta ganador en el registro actual.')

  const { error } = await supabase.rpc('admin_set_match_result', {
    p_match_id: fresh.id,
    p_score: (fresh.score_raw ?? []) as unknown as Json,
    p_winner_id: fresh.winner_id,
    p_status: 'closed',
    p_result_type: fresh.result_type ?? 'normal',
    p_game_type: fresh.game_type ?? 'best_of_3',
  })
  if (error) throw new Error(mapPostgresError(error))
}

/** Corrige marcador en disputa y lo valida oficialmente (RPC directo → `validated`). */
export async function adminCorrectDisputedMatch(input: {
  match: MatchRow
  sets: ScoreSet[]
  rules?: TournamentRules | null
}): Promise<void> {
  const { data, error: fetchError } = await supabase.from('matches').select('*').eq('id', input.match.id).single()
  if (fetchError) throw new Error(mapPostgresError(fetchError))
  const fresh = data as MatchRow

  if (fresh.status !== 'score_disputed') {
    throw new Error('Solo aplica a partidos pendientes de revisión administrativa.')
  }

  const rules = input.rules ?? (await getTournamentRules(fresh.tournament_id))
  if (!rules) throw new Error('No se encontraron reglas del torneo.')

  const { winnerId, payload, pScoreJson } = preparePlayerScoreSubmissionSync({
    match: fresh,
    sets: input.sets,
    rules,
  })

  const { error } = await supabase.rpc('admin_set_match_result', {
    p_match_id: fresh.id,
    p_score: pScoreJson,
    p_winner_id: winnerId,
    p_status: 'closed',
    p_result_type: fresh.result_type ?? 'normal',
    p_game_type: payload.game_type ?? fresh.game_type ?? 'best_of_3',
  })
  if (error) throw new Error(mapPostgresError(error))
}

/** Invalidación administrativa con auditoría vía RPC (logs). */
export async function adminInvalidateMatchResult(match: MatchRow): Promise<void> {
  if (match.status === 'score_disputed') {
    throw new Error('No puedes invalidar un partido refutado; valida o corrige el marcador.')
  }
  const { error } = await supabase.rpc('admin_set_match_result', {
    p_match_id: match.id,
    p_score: match.score_raw ?? ([] as unknown as Json),
    p_winner_id: null,
    p_status: 'cancelled',
    p_result_type: match.result_type ?? 'normal',
    p_game_type: match.game_type,
  })
  if (error) throw new Error(mapPostgresError(error))
}

export async function listMatchScoreLogs(matchId: string): Promise<
  Database['public']['Tables']['match_score_logs']['Row'][]
> {
  const { data, error } = await supabase
    .from('match_score_logs')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(mapPostgresError(error))
  return (data ?? []) as Database['public']['Tables']['match_score_logs']['Row'][]
}

export async function respondOpponentMatchScore(input: {
  matchId: string
  accept: boolean
  disputeReason?: string | null
}): Promise<MatchRow | undefined> {
  const { error } = await supabase.rpc('opponent_respond_match_score', {
    p_match_id: input.matchId,
    p_accept: input.accept,
    p_dispute_reason: input.disputeReason ?? null,
  })
  if (error) throw new Error(mapPostgresError(error))
  const { data, error: fetchError } = await supabase.from('matches').select('*').eq('id', input.matchId).single()
  if (fetchError) throw new Error(mapPostgresError(fetchError))
  return data as MatchRow
}

export async function acceptPlayerScore(matchId: string): Promise<MatchRow | undefined> {
  return respondOpponentMatchScore({ matchId, accept: true })
}

export async function acceptMatchScore(matchId: string, _playerId?: string): Promise<MatchRow | undefined> {
  void _playerId
  return acceptPlayerScore(matchId)
}

export async function rejectPlayerScore(input: {
  matchId: string
  disputeReason: string
}): Promise<MatchRow | undefined> {
  return respondOpponentMatchScore({
    matchId: input.matchId,
    accept: false,
    disputeReason: input.disputeReason,
  })
}

export async function rejectMatchScore(matchId: string, _playerId: string | undefined, reason: string): Promise<MatchRow | undefined> {
  void _playerId
  return rejectPlayerScore({ matchId, disputeReason: reason })
}

export async function adminReopenMatchResult(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reopen_match_result', {
    p_match_id: matchId,
  })
  if (error) throw new Error(mapPostgresError(error))
}

export type GenerateRrMode = 'fill' | 'reset'

/** Fila lista para insert en `matches` (round robin); sin I/O. */
export type RoundRobinMatchInsertRow = {
  tournament_id: string
  group_id: string
  player_a_id: string
  player_b_id: string
  player_a_user_id: string
  player_b_user_id: string
  created_by: string | null
  status: MatchStatus
}

/** Construye todos los cruces round robin en memoria (requiere `GroupPlayer.id` persistidos). */
export function buildRoundRobinMatchRows(input: {
  tournamentId: string
  groupId: string
  players: GroupPlayer[]
  createdBy: string | null
}): RoundRobinMatchInsertRow[] {
  const { tournamentId, groupId, players, createdBy } = input
  if (players.length < 2) return []
  if (players.length > 5) {
    throw new Error('Máximo 5 jugadores por grupo para round robin (reglas del producto).')
  }

  const rows: RoundRobinMatchInsertRow[] = []
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const c = orderPlayersCanonically(players[i], players[j])
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
  return rows
}

/** Alcance al generar cruces para varios grupos de un torneo. */
export type GenerateRrTournamentScope = 'all_eligible' | 'complete_groups_only'

export type GenerateRrTournamentGroupResult = {
  groupId: string
  groupName: string
  outcome: 'generated' | 'skipped'
  /** Inserciones en la última pasada RR (`fill`) o después de borrar en (`reset`). */
  matchesInserted?: number
  detail?: string
}

type GroupLike = {
  id: string
  name: string
  tournament_id: string
  max_players: number
  players: GroupPlayer[]
}

/**
 * Genera cruces RR en todos los grupos del torneo que cumplan el alcance.
 * Respeta el cupo `max_players` del grupo y el límite MVP de 5 jugadores por grupo.
 */
export async function generateRoundRobinForTournamentGroups(input: {
  tournamentId: string
  mode: GenerateRrMode
  scope: GenerateRrTournamentScope
  createdBy: string | null
  groups: GroupLike[]
}): Promise<GenerateRrTournamentGroupResult[]> {
  const results: GenerateRrTournamentGroupResult[] = []
  const inTournament = input.groups.filter((g) => g.tournament_id === input.tournamentId)

  for (const g of inTournament) {
    const n = g.players.length
    const cap = g.max_players ?? 5

    if (n < 2) {
      results.push({
        groupId: g.id,
        groupName: g.name,
        outcome: 'skipped',
        detail: 'Menos de 2 jugadores',
      })
      continue
    }
    if (n > 5) {
      results.push({
        groupId: g.id,
        groupName: g.name,
        outcome: 'skipped',
        detail: 'Más de 5 jugadores (límite del producto)',
      })
      continue
    }
    if (input.scope === 'complete_groups_only' && n < cap) {
      results.push({
        groupId: g.id,
        groupName: g.name,
        outcome: 'skipped',
        detail: `Grupo incompleto (${n}/${cap})`,
      })
      continue
    }

    try {
      const inserted = await generateRoundRobinMatches({
        tournamentId: input.tournamentId,
        groupId: g.id,
        players: g.players,
        createdBy: input.createdBy,
        mode: input.mode,
      })
      results.push({
        groupId: g.id,
        groupName: g.name,
        outcome: 'generated',
        matchesInserted: inserted,
      })
    } catch (e) {
      results.push({
        groupId: g.id,
        groupName: g.name,
        outcome: 'skipped',
        detail: e instanceof Error ? e.message : 'Error al generar',
      })
    }
  }

  return results
}

export async function generateRoundRobinMatches(input: {
  tournamentId: string
  groupId: string
  players: GroupPlayer[]
  createdBy: string | null
  mode?: GenerateRrMode
}): Promise<number> {
  const { tournamentId, groupId, players, createdBy, mode = 'fill' } = input

  if (mode === 'reset') {
    const { error: delError } = await supabase
      .from('matches')
      .delete()
      .eq('group_id', groupId)
    if (delError) throw delError
  }

  const existing = mode === 'fill' ? await listMatchesForGroup(groupId) : []
  const existingKeys = new Set(existing.map((m) => pairKey(m.player_a_id, m.player_b_id)))

  const built = buildRoundRobinMatchRows({ tournamentId, groupId, players, createdBy })
  const rows =
    mode === 'fill' && existingKeys.size > 0
      ? built.filter((r) => !existingKeys.has(pairKey(r.player_a_id, r.player_b_id)))
      : built

  if (rows.length === 0) return 0
  const { error } = await supabase.from('matches').insert(rows)
  if (error) throw new Error(mapPostgresError(error))
  return rows.length
}

export async function generateMatchesForGroupIfComplete(input: {
  groupId: string
  createdBy: string | null
}): Promise<{
  generated: boolean
  reason?: 'incomplete'
  expectedPlayers: number
  playerCount: number
  matchesInserted: number
}> {
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
    return {
      generated: false,
      reason: 'incomplete',
      expectedPlayers,
      playerCount: players.length,
      matchesInserted: 0,
    }
  }

  const inserted = await generateRoundRobinMatches({
    tournamentId: group.tournament_id,
    groupId: input.groupId,
    players,
    createdBy: input.createdBy,
    mode: 'fill',
  })

  return {
    generated: inserted > 0,
    expectedPlayers,
    playerCount: players.length,
    matchesInserted: inserted,
  }
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
