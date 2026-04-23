import type { GroupPlayer, MatchResultType, MatchRow, ScoreSet, TournamentRules } from '@/types/database'

import { invertScoreSets, setsWonForA, setsWonForB } from '@/utils/score'
import { idsEqual } from '@/utils/tournamentInvert'

export type RankingRow = {
  groupPlayerId: string
  userId: string
  displayName: string
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

type RulesPoints = Pick<
  TournamentRules,
  'points_per_win' | 'points_per_loss' | 'points_default_win' | 'points_default_loss'
>

function isDefaultType(rt: MatchResultType | null | undefined): boolean {
  return rt === 'default_win_a' || rt === 'default_win_b'
}

function matchCountsForGroupRanking(m: MatchRow): boolean {
  if (!m.winner_id || m.status === 'cancelled') return false
  return m.status === 'result_submitted' || m.status === 'confirmed' || m.status === 'corrected'
}

export function computeGroupRanking(players: GroupPlayer[], matches: MatchRow[], rules: RulesPoints): RankingRow[] {
  const byId = new Map<string, MutableStats>()
  for (const p of players) {
    byId.set(p.id, emptyStats(p))
  }

  for (const m of matches) {
    if (!m.winner_id) continue
    if (!matchCountsForGroupRanking(m)) continue

    const aId = m.player_a_id
    const bId = m.player_b_id
    const statsA = byId.get(aId)
    const statsB = byId.get(bId)
    if (!statsA || !statsB) continue

    const isDefault = isDefaultType(m.result_type)
    if (!isDefault) {
      if (!m.score_raw || m.score_raw.length === 0) continue
    }

    const sets: ScoreSet[] = isDefault ? [] : m.score_raw!

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

    const pWin = isDefault ? rules.points_default_win : rules.points_per_win
    const pLoss = isDefault ? rules.points_default_loss : rules.points_per_loss

    if (m.winner_id === aId) {
      statsA.won += 1
      statsB.lost += 1
      statsA.points += pWin
      statsB.points += pLoss
    } else if (m.winner_id === bId) {
      statsB.won += 1
      statsA.lost += 1
      statsB.points += pWin
      statsA.points += pLoss
    }
  }

  const rows = Array.from(byId.values()).sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points
    if (y.won !== x.won) return y.won - x.won
    const xsd = x.setsFor - x.setsAgainst
    const ysd = y.setsFor - y.setsAgainst
    if (ysd !== xsd) return ysd - xsd
    const xgd = x.gamesFor - x.gamesAgainst
    const ygd = y.gamesFor - y.gamesAgainst
    if (ygd !== xgd) return ygd - xgd
    return x.displayName.localeCompare(y.displayName)
  })

  return rows.map((r, idx) => ({ ...r, position: idx + 1 }))
}

export function perspectiveSetsForCell(
  rowPlayerId: string,
  _colPlayerId: string,
  match: MatchRow | undefined,
): ScoreSet[] | null {
  if (!match?.score_raw) return null
  if (idsEqual(rowPlayerId, match.player_a_id)) {
    return match.score_raw
  }
  if (idsEqual(rowPlayerId, match.player_b_id)) {
    return invertScoreSets(match.score_raw)
  }
  return null
}
