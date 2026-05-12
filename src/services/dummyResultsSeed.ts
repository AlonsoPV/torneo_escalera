import { isDummyResultsSeedEnabled } from '@/lib/dummyResultsSeedEnv'
import { isAdminRole } from '@/lib/permissions'
import { buildDummyScorePayload, dummyGameTypeForMatchOrdinal, pickDummyWinnerId } from '@/lib/dummyMatchScores'
import { supabase } from '@/lib/supabase'
import { listGroups } from '@/services/groups'
import {
  generateRoundRobinMatches,
  listMatchesForGroup,
  saveMatchScore,
} from '@/services/matches'
import { getTournament } from '@/services/tournaments'
import type { GroupPlayer, MatchRow } from '@/types/database'

export type SeedDummyResultsSummary = {
  groupsProcessed: number
  groupsSkipped: number
  matchesGenerated: number
  resultsGenerated: number
  errors: string[]
}

const MAX_PLAYERS_PER_GROUP_RR = 5

function isEligibleGroupMember(profile: { role: string } | undefined): boolean {
  return profile?.role === 'player'
}

function expectedRoundRobinPairCount(playerCount: number): number {
  return (playerCount * (playerCount - 1)) / 2
}

function timelineForDummyMatch(input: {
  tournamentCreatedAt: string
  groupOrderIndex: number
  matchOrdinal: number
}): {
  submittedAt: string
  opponentAt: string
  validatedAt: string
  closedAt: string
} {
  const base = new Date(input.tournamentCreatedAt)
  const dayShift = 1 + input.groupOrderIndex * 3 + Math.floor(input.matchOrdinal / 4)
  base.setUTCDate(base.getUTCDate() + dayShift)
  base.setUTCHours(14 + (input.matchOrdinal % 5), (input.matchOrdinal * 7) % 60, 0, 0)
  const t0 = base.getTime()
  return {
    submittedAt: new Date(t0 + 15 * 60 * 1000).toISOString(),
    opponentAt: new Date(t0 + 40 * 60 * 1000).toISOString(),
    validatedAt: new Date(t0 + 55 * 60 * 1000).toISOString(),
    closedAt: new Date(t0 + 60 * 60 * 1000).toISOString(),
  }
}

async function patchDummyOfficialWorkflowFields(input: {
  matchId: string
  playerAUserId: string
  playerBUserId: string
  adminUserId: string
  submittedAt: string
  opponentAt: string
  validatedAt: string
  closedAt: string
}): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({
      score_submitted_by: input.playerAUserId,
      score_submitted_at: input.submittedAt,
      opponent_confirmed_by: input.playerBUserId,
      opponent_confirmed_at: input.opponentAt,
      admin_validated_by: input.adminUserId,
      admin_validated_at: input.validatedAt,
      closed_at: input.closedAt,
    })
    .eq('id', input.matchId)
  if (error) throw new Error(error.message)
}

function isMatchAlreadyOfficiallyClosed(m: MatchRow): boolean {
  return m.status === 'closed'
}

/**
 * Para cada grupo con 2–5 jugadores con rol «player», genera **todos** los cruces round robin posibles entre
 * inscritos (fill), y asigna marcador ficticio **a todos los cruces que aún no lo tienen** (incluye
 * `cancelled` y estados previos a cerrado). Si ya hay `score_raw` pero el partido no está cerrado, solo se
 * oficializa el cierre sin cambiar el marcador. No pisa partidos ya `closed`.
 */
export async function seedDummyResultsForTournament(input: {
  tournamentId: string
  actorUserId: string
  actorRole: Parameters<typeof isAdminRole>[0]
}): Promise<SeedDummyResultsSummary> {
  if (!isDummyResultsSeedEnabled()) {
    throw new Error('La generación de datos dummy no está habilitada en este entorno.')
  }
  if (!isAdminRole(input.actorRole)) {
    throw new Error('Solo el staff administrador puede ejecutar esta acción.')
  }

  const summary: SeedDummyResultsSummary = {
    groupsProcessed: 0,
    groupsSkipped: 0,
    matchesGenerated: 0,
    resultsGenerated: 0,
    errors: [],
  }

  const tournament = await getTournament(input.tournamentId)
  if (!tournament) {
    summary.errors.push('Torneo no encontrado.')
    return summary
  }

  const groups = await listGroups(input.tournamentId)
  if (groups.length === 0) {
    summary.errors.push('El torneo no tiene grupos.')
    return summary
  }

  const groupIds = groups.map((g) => g.id)
  const { data: gpRows, error: gpErr } = await supabase
    .from('group_players')
    .select('*')
    .in('group_id', groupIds)
    .order('seed_order', { ascending: true })
    .order('id', { ascending: true })
  if (gpErr) throw gpErr

  const playersByGroup = new Map<string, GroupPlayer[]>()
  for (const g of groups) playersByGroup.set(g.id, [])
  for (const row of (gpRows ?? []) as GroupPlayer[]) {
    playersByGroup.get(row.group_id)?.push(row)
  }

  const userIds = [...new Set((gpRows ?? []).map((r: GroupPlayer) => r.user_id))]
  const { data: profileRows, error: profErr } = await supabase.from('profiles').select('id, role, status').in('id', userIds)
  if (profErr) throw profErr

  const profileByUserId = new Map((profileRows ?? []).map((p) => [p.id, p]))

  for (const group of groups) {
    const roster = playersByGroup.get(group.id) ?? []
    const n = roster.length

    if (n < 2) {
      summary.groupsSkipped += 1
      summary.errors.push(`Grupo «${group.name}»: hace falta al menos 2 jugadores para round robin (hay ${n}).`)
      continue
    }
    if (n > MAX_PLAYERS_PER_GROUP_RR) {
      summary.groupsSkipped += 1
      summary.errors.push(
        `Grupo «${group.name}»: hay ${n} jugadores; el límite para round robin en esta app es ${MAX_PLAYERS_PER_GROUP_RR}.`,
      )
      continue
    }

    const allEligible = roster.every((gp) => isEligibleGroupMember(profileByUserId.get(gp.user_id)))

    if (!allEligible) {
      summary.groupsSkipped += 1
      summary.errors.push(
        `Grupo «${group.name}»: cada inscrito debe tener perfil con rol jugador (role=player).`,
      )
      continue
    }

    const expectedPairs = expectedRoundRobinPairCount(n)

    try {
      const inserted = await generateRoundRobinMatches({
        tournamentId: input.tournamentId,
        groupId: group.id,
        players: roster,
        createdBy: input.actorUserId,
        mode: 'fill',
      })
      summary.matchesGenerated += inserted
    } catch (e) {
      summary.groupsSkipped += 1
      summary.errors.push(
        `Grupo «${group.name}»: error al generar cruces — ${e instanceof Error ? e.message : 'desconocido'}.`,
      )
      continue
    }

    const rosterIds = new Set(roster.map((p) => p.id))
    const matches = await listMatchesForGroup(group.id)
    const scopedMatches = matches.filter(
      (m) => rosterIds.has(m.player_a_id) && rosterIds.has(m.player_b_id),
    )

    if (scopedMatches.length !== expectedPairs) {
      summary.groupsSkipped += 1
      summary.errors.push(
        `Grupo «${group.name}»: se esperaban ${expectedPairs} partidos round robin entre integrantes y hay ${scopedMatches.length}.`,
      )
      continue
    }

    const sortedMatches = [...scopedMatches].sort((a, b) => {
      const ca = new Date(a.created_at).getTime()
      const cb = new Date(b.created_at).getTime()
      if (ca !== cb) return ca - cb
      return a.id.localeCompare(b.id)
    })

    let groupErrors = 0
    const totalToScore = sortedMatches.length
    for (let i = 0; i < sortedMatches.length; i++) {
      const m = sortedMatches[i]!
      if (isMatchAlreadyOfficiallyClosed(m)) continue

      try {
        const t = timelineForDummyMatch({
          tournamentCreatedAt: tournament.created_at,
          groupOrderIndex: group.order_index,
          matchOrdinal: i,
        })

        if (m.score_raw != null && Array.isArray(m.score_raw) && m.score_raw.length > 0) {
          await saveMatchScore({
            match: m,
            sets: m.score_raw,
            actorUserId: input.actorUserId,
            isAdmin: true,
            adminStatus: 'closed',
          })
        } else if (m.game_type === 'sudden_death' && m.winner_id) {
          await saveMatchScore({
            match: m,
            scorePayload: {
              game_type: 'sudden_death',
              score_json: null,
              winner: m.winner_id === m.player_b_id ? 'b' : 'a',
            },
            actorUserId: input.actorUserId,
            isAdmin: true,
            adminStatus: 'closed',
          })
        } else {
          const winnerId = pickDummyWinnerId(m)
          const gameType = dummyGameTypeForMatchOrdinal(i, totalToScore)
          const payload = buildDummyScorePayload(m, gameType, winnerId)
          await saveMatchScore({
            match: m,
            scorePayload: payload,
            actorUserId: input.actorUserId,
            isAdmin: true,
            adminStatus: 'closed',
          })
        }

        await patchDummyOfficialWorkflowFields({
          matchId: m.id,
          playerAUserId: m.player_a_user_id,
          playerBUserId: m.player_b_user_id,
          adminUserId: input.actorUserId,
          submittedAt: t.submittedAt,
          opponentAt: t.opponentAt,
          validatedAt: t.validatedAt,
          closedAt: t.closedAt,
        })
        summary.resultsGenerated += 1
      } catch (e) {
        groupErrors += 1
        summary.errors.push(
          `Grupo «${group.name}», partido ${m.id}: ${e instanceof Error ? e.message : 'error desconocido'}`,
        )
      }
    }

    if (groupErrors === 0) summary.groupsProcessed += 1
    else summary.groupsSkipped += 1
  }

  return summary
}
