import type {
  GroupStandingRow,
  MatchResultData,
  ScoreSet,
  SimGroup,
  SimMatch,
  SimPlayer,
  SimulationRatios,
  SimTournamentBundle,
} from '@/types/tournament'
import { calculateGroupStandings } from '@/utils/tournamentStandings'

const PLAYERS_TOTAL = 90
const GROUPS = 18
const PLAYERS_PER_GROUP = 5
const MATCHES_PER_GROUP = 10

/** Perfiles reales sustituyen a Jugador 1 y 2 en el Grupo 1 del demo (sim-player-1 / sim-player-2). */
export const DEMO_SIM_USER_ZAIAH_ID = '6042f4d5-8ceb-4e3b-9f88-674a330fc777'
export const DEMO_SIM_USER_EDGAR_ID = 'de10029f-061d-48c2-8aeb-cd43f4c437a3'

const SPOTLIGHT_PLAYERS: Record<string, { id: string; full_name: string }> = {
  'sim-player-1': { id: DEMO_SIM_USER_ZAIAH_ID, full_name: 'Zaiah' },
  'sim-player-2': {
    id: DEMO_SIM_USER_EDGAR_ID,
    full_name: 'Alonso Vazquez',
  },
}

function applySpotlightUsersToPlayers(players: SimPlayer[]): SimPlayer[] {
  return players.map((p) => {
    const s = SPOTLIGHT_PLAYERS[p.id]
    return s ? { ...p, id: s.id, full_name: s.full_name } : p
  })
}

export const DEFAULT_SIMULATION_RATIOS: SimulationRatios = {
  twoSetNormal: 0.75,
  threeSetNormal: 0.2,
  defaultWin: 0.05,
}

function rnd(): number {
  return Math.random()
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)]!
}

/** Sets ganados por A (marcador plausible a 6 games o tiebreak). */
const SETS_WON_BY_A: ScoreSet[] = [
  { a: 6, b: 0 },
  { a: 6, b: 1 },
  { a: 6, b: 2 },
  { a: 6, b: 3 },
  { a: 6, b: 4 },
  { a: 7, b: 5 },
  { a: 7, b: 6 },
]

const SETS_WON_BY_B: ScoreSet[] = SETS_WON_BY_A.map((s) => ({ a: s.b, b: s.a }))

function twoSetNormalMatch(): ScoreSet[] {
  const aWinsBoth = rnd() < 0.5
  if (aWinsBoth) {
    return [pick(SETS_WON_BY_A), pick(SETS_WON_BY_A)]
  }
  return [pick(SETS_WON_BY_B), pick(SETS_WON_BY_B)]
}

/** Gana 2-1 en sets: W-L-W desde perspectiva del ganador del partido. */
function threeSetNormalMatch(): ScoreSet[] {
  const winnerIsA = rnd() < 0.5
  const w = winnerIsA ? SETS_WON_BY_A : SETS_WON_BY_B
  const l = winnerIsA ? SETS_WON_BY_B : SETS_WON_BY_A
  return [pick(w), pick(l), pick(w)]
}

export function simulateMatchResult(
  ratios: SimulationRatios = DEFAULT_SIMULATION_RATIOS,
): MatchResultData {
  const sum = ratios.twoSetNormal + ratios.threeSetNormal + ratios.defaultWin
  const r = rnd() * sum
  if (r < ratios.twoSetNormal) {
    return { resultType: 'normal', score: twoSetNormalMatch() }
  }
  if (r < ratios.twoSetNormal + ratios.threeSetNormal) {
    return { resultType: 'normal', score: threeSetNormalMatch() }
  }
  return {
    resultType: 'default',
    defaultWinner: rnd() < 0.5 ? 'a' : 'b',
  }
}

function winnerFromNormal(score: ScoreSet[], playerAId: string, playerBId: string): string {
  let aW = 0
  let bW = 0
  for (const s of score) {
    if (s.a > s.b) aW++
    else if (s.b > s.a) bW++
  }
  if (aW > bW) return playerAId
  if (bW > aW) return playerBId
  return playerAId
}

export function matchFromSimulation(
  id: string,
  groupId: string,
  playerAId: string,
  playerBId: string,
  data: MatchResultData,
): SimMatch {
  if (data.resultType === 'default') {
    const winnerId = data.defaultWinner === 'a' ? playerAId : playerBId
    return {
      id,
      groupId,
      playerAId,
      playerBId,
      resultType: 'default',
      defaultWinner: data.defaultWinner,
      winnerId,
      status: 'confirmed',
    }
  }
  const winnerId = winnerFromNormal(data.score, playerAId, playerBId)
  return {
    id,
    groupId,
    playerAId,
    playerBId,
    resultType: 'normal',
    score: data.score,
    winnerId,
    status: 'confirmed',
  }
}

/** Orden canónico: menor seed_order, empate → id lexicográfico. */
export function orderPlayersCanonically(p: SimPlayer, q: SimPlayer): { a: SimPlayer; b: SimPlayer } {
  if (p.seed_order !== q.seed_order) {
    return p.seed_order < q.seed_order ? { a: p, b: q } : { a: q, b: p }
  }
  return p.id < q.id ? { a: p, b: q } : { a: q, b: p }
}

export function generatePlayers(groups: SimGroup[]): SimPlayer[] {
  const players: SimPlayer[] = []
  let n = 1
  for (const g of groups) {
    for (let s = 1; s <= PLAYERS_PER_GROUP; s++) {
      players.push({
        id: `sim-player-${n}`,
        full_name: `Jugador ${n}`,
        seed_order: s,
        group_id: g.id,
      })
      n++
    }
  }
  return players
}

export function generateGroups(): SimGroup[] {
  return Array.from({ length: GROUPS }, (_, i) => ({
    id: `sim-group-${i + 1}`,
    name: `Grupo ${i + 1}`,
    order_index: i,
  }))
}

export function generateRoundRobinMatchesForGroup(
  groupId: string,
  groupPlayers: SimPlayer[],
  matchIdPrefix: string,
  ratios?: SimulationRatios,
): SimMatch[] {
  const sorted = [...groupPlayers].sort((x, y) => {
    if (x.seed_order !== y.seed_order) return x.seed_order - y.seed_order
    return x.id.localeCompare(y.id)
  })
  const matches: SimMatch[] = []
  let k = 0
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const { a, b } = orderPlayersCanonically(sorted[i]!, sorted[j]!)
      const data = simulateMatchResult(ratios ?? DEFAULT_SIMULATION_RATIOS)
      matches.push(
        matchFromSimulation(`${matchIdPrefix}-${k++}`, groupId, a.id, b.id, data),
      )
    }
  }
  return matches
}

export function playersByGroup(players: SimPlayer[]): Record<string, SimPlayer[]> {
  const map: Record<string, SimPlayer[]> = {}
  for (const p of players) {
    if (!map[p.group_id]) map[p.group_id] = []
    map[p.group_id]!.push(p)
  }
  for (const k of Object.keys(map)) {
    map[k]!.sort((a, b) => a.seed_order - b.seed_order || a.id.localeCompare(b.id))
  }
  return map
}

export function generateTournamentSimulation(
  ratios: SimulationRatios = DEFAULT_SIMULATION_RATIOS,
): SimTournamentBundle {
  const groups = generateGroups()
  const players = applySpotlightUsersToPlayers(generatePlayers(groups))
  const byGroup = playersByGroup(players)
  const matchesByGroupId: Record<string, SimMatch[]> = {}
  const standingsByGroupId: Record<string, GroupStandingRow[]> = {}

  for (const g of groups) {
    const gp = byGroup[g.id] ?? []
    const matches = generateRoundRobinMatchesForGroup(g.id, gp, `m-${g.id}`, ratios)
    matchesByGroupId[g.id] = matches
    standingsByGroupId[g.id] = calculateGroupStandings(gp, matches)
  }

  const playersByGroupId: Record<string, SimPlayer[]> = { ...byGroup }

  return {
    tournamentName: 'Torneo Mega Varonil',
    groups,
    playersByGroupId,
    matchesByGroupId,
    standingsByGroupId,
  }
}

export { PLAYERS_TOTAL, GROUPS, PLAYERS_PER_GROUP, MATCHES_PER_GROUP }
