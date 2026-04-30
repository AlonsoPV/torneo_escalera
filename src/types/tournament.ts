/** Tipos para la simulación demo de torneo (sin Supabase). */

export type ScoreSet = { a: number; b: number }

export type MatchResultData =
  | { resultType: 'normal'; score: ScoreSet[] }
  | { resultType: 'default'; defaultWinner: 'a' | 'b' }

export type SimPlayer = {
  id: string
  full_name: string
  seed_order: number
  group_id: string
}

export type SimGroup = {
  id: string
  name: string
  order_index: number
}

export type SimMatch = {
  id: string
  groupId: string
  playerAId: string
  playerBId: string
  resultType: 'normal' | 'default'
  score?: ScoreSet[]
  defaultWinner?: 'a' | 'b'
  /** null = partido aún sin resultado (matriz / listados). */
  winnerId: string | null
  status: 'scheduled' | 'closed'
}

export type SimTournamentBundle = {
  tournamentName: string
  groups: SimGroup[]
  playersByGroupId: Record<string, SimPlayer[]>
  matchesByGroupId: Record<string, SimMatch[]>
  standingsByGroupId: Record<string, GroupStandingRow[]>
}

export type GroupStandingRow = {
  playerId: string
  displayName: string
  seed_order: number
  position: number
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

export type SimulationRatios = {
  /** Fracción [0,1] — se normaliza internamente */
  twoSetNormal: number
  threeSetNormal: number
  defaultWin: number
}
