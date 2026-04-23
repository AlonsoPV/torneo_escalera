import type { GroupStandingRow, ScoreSet, SimMatch, SimPlayer } from '@/types/tournament'

function sumGames(sets: ScoreSet[], forA: boolean): number {
  return sets.reduce((acc, s) => acc + (forA ? s.a : s.b), 0)
}

function setsWon(sets: ScoreSet[], forA: boolean): number {
  return sets.filter((s) => (forA ? s.a > s.b : s.b > s.a)).length
}

/** Puntos: normal → ganador 3, perdedor 1. Default → ganador 2, perdedor -1 (exclusivo). */
export function calculateGroupStandings(
  players: SimPlayer[],
  matches: SimMatch[],
): GroupStandingRow[] {
  type Acc = {
    played: number
    won: number
    lost: number
    defaultsWon: number
    defaultsLost: number
    setsFor: number
    setsAgainst: number
    gamesFor: number
    gamesAgainst: number
    points: number
  }

  const byId = new Map<string, Acc>()
  for (const p of players) {
    byId.set(p.id, {
      played: 0,
      won: 0,
      lost: 0,
      defaultsWon: 0,
      defaultsLost: 0,
      setsFor: 0,
      setsAgainst: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      points: 0,
    })
  }

  for (const m of matches) {
    if (m.winnerId == null) continue

    const sa = byId.get(m.playerAId)
    const sb = byId.get(m.playerBId)
    if (!sa || !sb) continue

    sa.played += 1
    sb.played += 1

    const aWon = m.winnerId === m.playerAId

    if (m.resultType === 'default') {
      if (aWon) {
        sa.won += 1
        sb.lost += 1
        sa.defaultsWon += 1
        sb.defaultsLost += 1
        sa.points += 2
        sb.points -= 1
      } else {
        sb.won += 1
        sa.lost += 1
        sb.defaultsWon += 1
        sa.defaultsLost += 1
        sb.points += 2
        sa.points -= 1
      }
      continue
    }

    const sets = m.score ?? []
    const aSetsWon = setsWon(sets, true)
    const bSetsWon = setsWon(sets, false)
    const aGames = sumGames(sets, true)
    const bGames = sumGames(sets, false)

    sa.setsFor += aSetsWon
    sa.setsAgainst += bSetsWon
    sb.setsFor += bSetsWon
    sb.setsAgainst += aSetsWon
    sa.gamesFor += aGames
    sa.gamesAgainst += bGames
    sb.gamesFor += bGames
    sb.gamesAgainst += aGames

    if (aWon) {
      sa.won += 1
      sb.lost += 1
      sa.points += 3
      sb.points += 1
    } else {
      sb.won += 1
      sa.lost += 1
      sb.points += 3
      sa.points += 1
    }
  }

  const rows: GroupStandingRow[] = players.map((p) => {
    const s = byId.get(p.id)!
    return {
      playerId: p.id,
      displayName: p.full_name,
      seed_order: p.seed_order,
      position: 0,
      played: s.played,
      won: s.won,
      lost: s.lost,
      defaultsWon: s.defaultsWon,
      defaultsLost: s.defaultsLost,
      setsFor: s.setsFor,
      setsAgainst: s.setsAgainst,
      gamesFor: s.gamesFor,
      gamesAgainst: s.gamesAgainst,
      points: s.points,
    }
  })

  rows.sort((x, y) => {
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
