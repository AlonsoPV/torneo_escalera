/**
 * Herramientas DEV para auditar ranking vs Excel (Grupo 1, etc.).
 * No llamar desde código de producción sin guard `import.meta.env.DEV`.
 */
import { resolveRankingPointsRules } from '@/domain/tournamentRankingPoints'
import { supabase } from '@/lib/supabase'
import { importResultTypeBothPenalized, importResultTypeUsesDefaultPoints } from '@/lib/matchResultSemantics'
import { listGroupPlayers } from '@/services/groups'
import { listMatchesForGroup } from '@/services/matches'
import { getTournamentRules } from '@/services/tournaments'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'

import { getOfficialWinnerGroupPlayerId, getWinnerFromScoreOnly } from '@/utils/matchOfficialWinner'
import { computeGroupRanking, matchIncludedInRanking, type RulesPoints } from '@/utils/ranking'
import { formatScoreCompact } from '@/utils/score'
import { idsEqual } from '@/utils/tournamentInvert'

function pairKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`
}

function previewMatchPoints(m: MatchRow, rules: TournamentRules): { ptsA: number | null; ptsB: number | null } {
  const pts = resolveRankingPointsRules(rules)
  if (importResultTypeBothPenalized(m.result_type)) {
    return { ptsA: pts.penaltyBoth, ptsB: pts.penaltyBoth }
  }
  const official = getOfficialWinnerGroupPlayerId(m, rules)
  if (!official) return { ptsA: null, ptsB: null }
  const def = importResultTypeUsesDefaultPoints(m.result_type)
  const pWin = def ? pts.defaultWin : pts.normalWin
  const pLoss = def ? pts.defaultLoss : pts.normalLoss
  if (idsEqual(official, m.player_a_id)) return { ptsA: pWin, ptsB: pLoss }
  if (idsEqual(official, m.player_b_id)) return { ptsA: pLoss, ptsB: pWin }
  return { ptsA: null, ptsB: null }
}

function matchCountedInRanking(m: MatchRow, playerIdsInGroup: Set<string>, rules: RulesPoints): boolean {
  if (!playerIdsInGroup.has(m.player_a_id) || !playerIdsInGroup.has(m.player_b_id)) return false
  return matchIncludedInRanking(m, rules)
}

async function resolveGroupByNameOrId(
  label: string,
): Promise<{ id: string; name: string; tournament_id: string } | null> {
  const t = label.trim()
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (uuidRe.test(t)) {
    const { data } = await supabase.from('groups').select('id,name,tournament_id').eq('id', t).maybeSingle()
    return data ?? null
  }
  const exact = await supabase.from('groups').select('id,name,tournament_id').eq('name', t).maybeSingle()
  if (exact.data) return exact.data
  const partial = await supabase.from('groups').select('id,name,tournament_id').ilike('name', `%${t}%`).limit(8)
  const rows = partial.data ?? []
  if (rows.length === 0) return null
  if (rows.length > 1) {
    console.warn('[debugStandingsForGroup] varios grupos coinciden; usa UUID o nombre exacto:', rows.map((r) => r.name))
  }
  return rows[0] ?? null
}

/**
 * Salida detallada por partido: ganador importado vs inferido por marcador vs ganador oficial usado en ranking.
 */
export async function debugStandingsForGroup(groupLabel: string): Promise<void> {
  if (!import.meta.env.DEV) {
    console.warn('[debugStandingsForGroup] omitido: no es entorno DEV')
    return
  }

  const group = await resolveGroupByNameOrId(groupLabel)
  if (!group) {
    console.warn('[debugStandingsForGroup] grupo no encontrado:', groupLabel)
    return
  }

  const rules = await getTournamentRules(group.tournament_id)
  if (!rules) {
    console.warn('[debugStandingsForGroup] sin reglas torneo', group.tournament_id)
    return
  }

  const [players, matches] = await Promise.all([listGroupPlayers(group.id), listMatchesForGroup(group.id)])
  const nameById = new Map(players.map((p: GroupPlayer) => [p.id, p.display_name]))

  console.log('[debugStandingsForGroup]', group.name, 'id=', group.id)

  for (const m of matches) {
    const aName = nameById.get(m.player_a_id) ?? m.player_a_id.slice(0, 8)
    const bName = nameById.get(m.player_b_id) ?? m.player_b_id.slice(0, 8)
    const scoreLabel = m.score_raw?.length ? formatScoreCompact(m.score_raw) : '—'
    const importedLabel =
      m.winner_id && (idsEqual(m.winner_id, m.player_a_id) || idsEqual(m.winner_id, m.player_b_id))
        ? nameById.get(m.winner_id) ?? m.winner_id.slice(0, 8)
        : m.winner_id
          ? '?'
          : '—'
    const calcGp = getWinnerFromScoreOnly(m, rules)
    const calculatedLabel = calcGp ? nameById.get(calcGp) ?? calcGp.slice(0, 8) : '—'
    const finalGp = getOfficialWinnerGroupPlayerId(m, rules)
    const finalLabel = finalGp ? nameById.get(finalGp) ?? finalGp.slice(0, 8) : '—'
    const pts = previewMatchPoints(m, rules)
    console.log(
      `${aName} vs ${bName} | score ${scoreLabel} | imported winner=${importedLabel} | calculatedWinner=${calculatedLabel} | finalWinner=${finalLabel} | pts ${aName} ${pts.ptsA ?? '—'} / ${bName} ${pts.ptsB ?? '—'} | status=${m.status}`,
    )
  }

  const standingsDbg = computeGroupRanking(players, matches, rules)
  console.table(
    standingsDbg.map((r) => ({
      pos: r.position,
      jugador: r.displayName,
      PJ: r.played,
      JG: r.won,
      JP: r.lost,
      PTS: r.points,
    })),
  )
  console.table(
    standingsDbg.map((p) => ({
      player: p.displayName,
      wins: p.won,
      losses: p.lost,
      points: p.points,
    })),
  )
}

/**
 * Carga jugadores/partidos del grupo, imprime validación round-robin y tabla de ranking.
 * Solo efecto en `import.meta.env.DEV`.
 */
export async function debugGroupStandings(groupId: string): Promise<void> {
  if (!import.meta.env.DEV) {
    console.warn('[debugGroupStandings] omitido: no es entorno DEV')
    return
  }

  const [players, matches] = await Promise.all([listGroupPlayers(groupId), listMatchesForGroup(groupId)])

  let tid: string | null = matches[0]?.tournament_id ?? null
  if (!tid) {
    const { data: gRow } = await supabase.from('groups').select('tournament_id').eq('id', groupId).maybeSingle()
    tid = gRow?.tournament_id ?? null
  }

  if (!tid) {
    console.warn('[debugGroupStandings] no se pudo resolver tournament_id para grupo', groupId)
    console.table(players.map((p) => ({ id: p.id, display_name: p.display_name })))
    return
  }

  const rules = await getTournamentRules(tid)
  if (!rules) {
    console.warn('[debugGroupStandings] reglas no encontradas para tournament', tid)
    return
  }

  const rulesRank: RulesPoints = rules

  const playerIds = new Set(players.map((p) => p.id))
  const nameById = new Map(players.map((p: GroupPlayer) => [p.id, p.display_name]))

  const n = players.length
  const expectedPairs = (n * (n - 1)) / 2
  const pairSeen = new Map<string, number>()
  for (const m of matches) {
    const k = pairKey(m.player_a_id, m.player_b_id)
    pairSeen.set(k, (pairSeen.get(k) ?? 0) + 1)
  }

  const duplicates = [...pairSeen.entries()].filter(([, c]) => c > 1)
  const uniquePairs = pairSeen.size

  console.log('[debugGroupStandings] grupo', groupId, 'jugadores', n, 'partidos filas', matches.length)
  console.log('[debugGroupStandings] round-robin: pares únicos', uniquePairs, 'esperados', expectedPairs)
  if (duplicates.length) {
    console.warn('[debugGroupStandings] DUPLICADOS par A-B:', duplicates)
  }

  const matchRows = matches.map((m) => {
    const { ptsA, ptsB } = previewMatchPoints(m, rules)
    const counted = matchCountedInRanking(m, playerIds, rulesRank)
    const finalGp = getOfficialWinnerGroupPlayerId(m, rules)
    return {
      id: m.id.slice(0, 8),
      a: nameById.get(m.player_a_id) ?? m.player_a_id.slice(0, 8),
      b: nameById.get(m.player_b_id) ?? m.player_b_id.slice(0, 8),
      status: m.status,
      result_type: m.result_type,
      game_type: m.game_type,
      sets: m.score_raw?.length ?? 0,
      imported_w:
        m.winner_id && idsEqual(m.winner_id, m.player_a_id)
          ? 'A'
          : m.winner_id && idsEqual(m.winner_id, m.player_b_id)
            ? 'B'
            : m.winner_id
              ? '?'
              : '—',
      final_w:
        finalGp && idsEqual(finalGp, m.player_a_id) ? 'A' : finalGp && idsEqual(finalGp, m.player_b_id) ? 'B' : '—',
      eligible: matchIncludedInRanking(m, rulesRank),
      counted,
      pts_A: ptsA,
      pts_B: ptsB,
    }
  })

  console.table(matchRows)

  const standings = computeGroupRanking(players, matches, rulesRank)
  console.table(
    standings.map((r) => ({
      pos: r.position,
      jugador: r.displayName,
      PJ: r.played,
      JG: r.won,
      JP: r.lost,
      PTS: r.points,
      games_for: r.gamesFor,
      games_against: r.gamesAgainst,
      games_diff: r.gamesFor - r.gamesAgainst,
      sets_diff: r.setsFor - r.setsAgainst,
    })),
  )

  console.table(
    standings.map((p) => ({
      player: p.displayName,
      wins: p.won,
      losses: p.lost,
      points: p.points,
    })),
  )
}
