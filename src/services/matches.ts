import { supabase } from '@/lib/supabase'
import type { GroupPlayer, MatchRow, ScoreSet } from '@/types/database'
import { getTournamentRules } from '@/services/tournaments'
import { orderPlayersCanonically } from '@/utils/matches'
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

  const hadScore =
    Array.isArray(input.match.score_raw) && input.match.score_raw.length > 0

  const nextStatus = input.isAdmin
    ? hadScore
      ? 'corrected'
      : 'confirmed'
    : 'confirmed'

  const lockedAt = input.match.locked_at ?? new Date().toISOString()

  const { error } = await supabase
    .from('matches')
    .update({
      score_raw: input.sets,
      winner_id: winnerId,
      status: nextStatus,
      updated_by: input.actorUserId,
      locked_at: lockedAt,
    })
    .eq('id', input.match.id)
  if (error) throw error
}

export async function generateRoundRobinMatches(input: {
  tournamentId: string
  groupId: string
  players: GroupPlayer[]
  createdBy: string | null
}): Promise<void> {
  const { tournamentId, groupId, players, createdBy } = input
  if (players.length < 2) return

  const { error: delError } = await supabase
    .from('matches')
    .delete()
    .eq('group_id', groupId)
  if (delError) throw delError

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

  const { error } = await supabase.from('matches').insert(rows)
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
