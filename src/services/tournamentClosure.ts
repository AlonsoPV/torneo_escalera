import { supabase } from '@/lib/supabase'
import { getAdminGroupsForTournament } from '@/services/admin'
import { getTournamentRules, updateTournament } from '@/services/tournaments'
import { sortGroupStandingsForMovement } from '@/utils/nextTournamentPromotion'
import { computeGroupRanking } from '@/utils/ranking'

export type TournamentClosureCounts = {
  pendingScore: number
  scoreSubmitted: number
  scoreDisputed: number
  playerConfirmed: number
  /** Partidos que no están closed ni cancelled. */
  openMatches: number
}

export type TournamentClosureBlockersResult = {
  canClose: boolean
  counts: TournamentClosureCounts
  messages: string[]
}

export async function getTournamentClosureBlockers(tournamentId: string): Promise<TournamentClosureBlockersResult> {
  const groups = await getAdminGroupsForTournament(tournamentId)
  const counts: TournamentClosureCounts = {
    pendingScore: 0,
    scoreSubmitted: 0,
    scoreDisputed: 0,
    playerConfirmed: 0,
    openMatches: 0,
  }

  const seenMatchIds = new Set<string>()
  for (const g of groups) {
    for (const m of g.matches) {
      if (seenMatchIds.has(m.id)) continue
      seenMatchIds.add(m.id)
      if (m.status !== 'closed' && m.status !== 'cancelled') {
        counts.openMatches += 1
      }
      if (m.status === 'pending_score') counts.pendingScore += 1
      else if (m.status === 'score_submitted') counts.scoreSubmitted += 1
      else if (m.status === 'score_disputed') counts.scoreDisputed += 1
      else if (m.status === 'player_confirmed') counts.playerConfirmed += 1
    }
  }

  const messages: string[] = []
  if (counts.pendingScore > 0) {
    messages.push(`${counts.pendingScore} partido(s) pendiente(s) de marcador`)
  }
  if (counts.scoreSubmitted > 0) {
    messages.push(`${counts.scoreSubmitted} resultado(s) pendiente(s) de confirmación del rival`)
  }
  if (counts.scoreDisputed > 0) {
    messages.push(`${counts.scoreDisputed} resultado(s) en disputa`)
  }
  if (counts.playerConfirmed > 0) {
    messages.push(`${counts.playerConfirmed} resultado(s) pendiente(s) de validación del admin`)
  }

  const canClose = counts.openMatches === 0

  return { canClose, counts, messages }
}

export async function finishTournament(params: { tournamentId: string; closedBy: string }): Promise<void> {
  const { tournamentId, closedBy } = params

  const blockers = await getTournamentClosureBlockers(tournamentId)
  if (!blockers.canClose) {
    const intro = 'No puedes cerrar este torneo todavía.'
    const detail = blockers.messages.length > 0 ? blockers.messages.join('\n') : 'Hay partidos u operaciones pendientes.'
    throw new Error(`${intro}\n${detail}`)
  }

  const [groups, rules] = await Promise.all([getAdminGroupsForTournament(tournamentId), getTournamentRules(tournamentId)])

  if (!rules) {
    throw new Error('No hay reglas de torneo configuradas; no se puede calcular la clasificación final.')
  }

  const snapshotRows: Array<{
    tournament_id: string
    group_id: string
    group_order_index: number
    player_id: string
    position: number
    points: number
    games_for: number
    games_against: number
    games_difference: number
    wins: number
    losses: number
  }> = []

  for (const g of groups) {
    if (g.players.length === 0) continue

    const ranking = sortGroupStandingsForMovement(
      computeGroupRanking(
        g.players.map(({ id, user_id, group_id, display_name, seed_order, created_at }) => ({
          id,
          user_id,
          group_id,
          display_name,
          seed_order,
          created_at,
        })),
        g.matches,
        rules,
      ),
    )

    for (const row of ranking) {
      const gd = row.gamesFor - row.gamesAgainst
      snapshotRows.push({
        tournament_id: tournamentId,
        group_id: g.id,
        group_order_index: g.order_index,
        player_id: row.userId,
        position: row.position,
        points: row.points,
        games_for: row.gamesFor,
        games_against: row.gamesAgainst,
        games_difference: gd,
        wins: row.won,
        losses: row.lost,
      })
    }
  }

  const { error: delErr } = await supabase.from('tournament_final_standings').delete().eq('tournament_id', tournamentId)
  if (delErr) throw delErr

  const chunkSize = 500
  for (let i = 0; i < snapshotRows.length; i += chunkSize) {
    const chunk = snapshotRows.slice(i, i + chunkSize)
    const { error: insErr } = await supabase.from('tournament_final_standings').insert(chunk)
    if (insErr) throw insErr
  }

  const finishedAt = new Date().toISOString()
  await updateTournament(tournamentId, {
    status: 'finished',
    finished_at: finishedAt,
    closed_by: closedBy,
  })
}
