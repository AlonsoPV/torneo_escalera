import {
  importResultTypeBothPenalized,
  importResultTypeUsesDefaultPoints,
  syntheticAdministrativeSetsForDefaultMatch,
} from '@/lib/matchResultSemantics'
import type { GroupPlayer, MatchResultType, MatchRow, ScoreSet, TournamentRules } from '@/types/database'

import { resolveRankingPointsRules } from '@/domain/tournamentRankingPoints'
import { getOfficialWinnerGroupPlayerId } from '@/utils/matchOfficialWinner'
import { invertScoreSets, setsWonForA, setsWonForB } from '@/utils/score'
import { idsEqual } from '@/utils/tournamentInvert'

export type RankingRow = {
  groupPlayerId: string
  userId: string
  displayName: string
  seed_order: number
  played: number
  won: number
  lost: number
  setsFor: number
  setsAgainst: number
  gamesFor: number
  gamesAgainst: number
  points: number
  position: number
}

type MutableStats = Omit<RankingRow, 'position'>

function emptyStats(gp: GroupPlayer): MutableStats {
  return {
    groupPlayerId: gp.id,
    userId: gp.user_id,
    displayName: gp.display_name,
    seed_order: gp.seed_order,
    played: 0,
    won: 0,
    lost: 0,
    setsFor: 0,
    setsAgainst: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    points: 0,
  }
}

function sumGames(sets: ScoreSet[], forA: boolean): number {
  return sets.reduce((acc, s) => acc + (forA ? s.a : s.b), 0)
}

export type RulesPoints = Pick<
  TournamentRules,
  'points_per_win' | 'points_per_loss' | 'points_default_win' | 'points_default_loss' | 'best_of_sets'
>

function isDefaultType(rt: MatchResultType | null | undefined): boolean {
  return importResultTypeUsesDefaultPoints(rt)
}

function matchCountsForGroupRanking(m: MatchRow, rules: RulesPoints): boolean {
  if (m.status === 'cancelled') return false
  if (importResultTypeBothPenalized(m.result_type)) {
    return m.status === 'closed' || m.status === 'validated'
  }
  if (m.status !== 'closed' && m.status !== 'validated') return false
  return getOfficialWinnerGroupPlayerId(m, rules) != null
}

/** Partido cerrado que entra al cómputo (ganador en BD o inferible por marcador). */
export function matchIncludedInRanking(m: MatchRow, rules: RulesPoints): boolean {
  return matchCountsForGroupRanking(m, rules)
}

/**
 * Hay ganador aplicable para puntos (penalización mutua, `winner_id` oficial o inferido solo si falta en BD).
 */
export function isHistoricalResultValidForRanking(m: MatchRow, rules: RulesPoints): boolean {
  return matchIncludedInRanking(m, rules)
}

type RankingSortFields = Pick<
  RankingRow,
  'points' | 'gamesFor' | 'gamesAgainst' | 'won' | 'setsFor' | 'setsAgainst' | 'seed_order' | 'displayName'
>

/** Comparador único: PTS, juegos a favor, diferencia de juegos, partidos ganados, diferencia de sets, semilla, nombre. */
export function compareRankingRowsForLeaderboard(x: RankingSortFields, y: RankingSortFields): number {
  if (y.points !== x.points) return y.points - x.points
  if (y.gamesFor !== x.gamesFor) return y.gamesFor - x.gamesFor
  const xgd = x.gamesFor - x.gamesAgainst
  const ygd = y.gamesFor - y.gamesAgainst
  if (ygd !== xgd) return ygd - xgd
  if (y.won !== x.won) return y.won - x.won
  const xsd = x.setsFor - x.setsAgainst
  const ysd = y.setsFor - y.setsAgainst
  if (ysd !== xsd) return ysd - xsd
  if (x.seed_order !== y.seed_order) return x.seed_order - y.seed_order
  return x.displayName.localeCompare(y.displayName)
}

export function computeGroupRanking(players: GroupPlayer[], matches: MatchRow[], rules: RulesPoints): RankingRow[] {
  const byId = new Map<string, MutableStats>()
  for (const p of players) {
    byId.set(p.id, emptyStats(p))
  }

  const ptsRules = resolveRankingPointsRules(rules)

  const seenMatchIds = new Set<string>()
  for (const m of matches) {
    if (seenMatchIds.has(m.id)) continue
    seenMatchIds.add(m.id)

    if (!matchCountsForGroupRanking(m, rules)) continue

    const aId = m.player_a_id
    const bId = m.player_b_id
    const statsA = byId.get(aId)
    const statsB = byId.get(bId)
    if (!statsA || !statsB) continue

    if (importResultTypeBothPenalized(m.result_type)) {
      statsA.played += 1
      statsB.played += 1
      statsA.lost += 1
      statsB.lost += 1
      statsA.points += ptsRules.penaltyBoth
      statsB.points += ptsRules.penaltyBoth
      continue
    }

    const effectiveWinnerId = getOfficialWinnerGroupPlayerId(m, rules)
    if (!effectiveWinnerId) continue

    const isDefault = isDefaultType(m.result_type)
    const adminSets = syntheticAdministrativeSetsForDefaultMatch(m)
    const sets: ScoreSet[] =
      isDefault
        ? adminSets ?? (m.score_raw?.length ? m.score_raw : [])
        : m.game_type === 'sudden_death' && (!m.score_raw || m.score_raw.length !== 3)
          ? adminSets ?? (m.score_raw?.length ? m.score_raw : [])
          : m.score_raw?.length
            ? m.score_raw
            : []

    statsA.played += 1
    statsB.played += 1

    if (sets.length > 0) {
      const aSets = setsWonForA(sets)
      const bSets = setsWonForB(sets)
      const aGames = sumGames(sets, true)
      const bGames = sumGames(sets, false)

      statsA.setsFor += aSets
      statsA.setsAgainst += bSets
      statsB.setsFor += bSets
      statsB.setsAgainst += aSets
      statsA.gamesFor += aGames
      statsA.gamesAgainst += bGames
      statsB.gamesFor += bGames
      statsB.gamesAgainst += aGames
    }

    const winPts = isDefault ? ptsRules.defaultWin : ptsRules.normalWin
    const lossPts = isDefault ? ptsRules.defaultLoss : ptsRules.normalLoss

    if (idsEqual(effectiveWinnerId, aId)) {
      statsA.won += 1
      statsB.lost += 1
      statsA.points += winPts
      statsB.points += lossPts
    } else if (idsEqual(effectiveWinnerId, bId)) {
      statsB.won += 1
      statsA.lost += 1
      statsB.points += winPts
      statsA.points += lossPts
    }
  }

  const rows = Array.from(byId.values()).sort(compareRankingRowsForLeaderboard)

  return rows.map((r, idx) => ({ ...r, position: idx + 1 }))
}

export function perspectiveSetsForCell(
  rowPlayerId: string,
  _colPlayerId: string,
  match: MatchRow | undefined,
): ScoreSet[] | null {
  if (!match) return null
  const canonical =
    match.score_raw?.length ? match.score_raw : syntheticAdministrativeSetsForDefaultMatch(match)
  if (!canonical?.length) return null
  if (idsEqual(rowPlayerId, match.player_a_id)) {
    return canonical
  }
  if (idsEqual(rowPlayerId, match.player_b_id)) {
    return invertScoreSets(canonical)
  }
  return null
}
