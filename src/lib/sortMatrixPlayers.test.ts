import { describe, expect, it } from 'vitest'

import { matrixPositionLabel, sortPlayersByStandingPosition } from '@/lib/sortMatrixPlayers'
import type { GroupStandingRow, SimPlayer } from '@/types/tournament'

const players: SimPlayer[] = [
  { id: 'a', full_name: 'A', seed_order: 3, group_id: 'g1' },
  { id: 'b', full_name: 'B', seed_order: 1, group_id: 'g1' },
  { id: 'c', full_name: 'C', seed_order: 2, group_id: 'g1' },
]

const standings: GroupStandingRow[] = [
  {
    playerId: 'a',
    displayName: 'A',
    seed_order: 3,
    position: 2,
    played: 2,
    won: 1,
    lost: 1,
    defaultsWon: 0,
    defaultsLost: 0,
    setsFor: 0,
    setsAgainst: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    points: 3,
  },
  {
    playerId: 'b',
    displayName: 'B',
    seed_order: 1,
    position: 1,
    played: 2,
    won: 2,
    lost: 0,
    defaultsWon: 0,
    defaultsLost: 0,
    setsFor: 0,
    setsAgainst: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    points: 6,
  },
  {
    playerId: 'c',
    displayName: 'C',
    seed_order: 2,
    position: 3,
    played: 2,
    won: 0,
    lost: 2,
    defaultsWon: 0,
    defaultsLost: 0,
    setsFor: 0,
    setsAgainst: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    points: 0,
  },
]

describe('sortPlayersByStandingPosition', () => {
  it('ordena por posición en tabla, no por seed', () => {
    const sorted = sortPlayersByStandingPosition(players, standings)
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })

  it('matrixPositionLabel usa position de standings', () => {
    const sorted = sortPlayersByStandingPosition(players, standings)
    expect(matrixPositionLabel(sorted[0]!.id, 0, standings)).toBe(1)
    expect(matrixPositionLabel(sorted[1]!.id, 1, standings)).toBe(2)
    expect(matrixPositionLabel(sorted[2]!.id, 2, standings)).toBe(3)
  })
})
