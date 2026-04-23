/**
 * Grupo demo fijo (5 jugadores) para la pantalla «Mi torneo».
 * Marcadores alineados con la tabla de demostración (Zaiah, Alonso Vazquez, Edgar, Jugador 4–5).
 */
import type { GroupPlayer } from '@/types/database'
import type {
  GroupStandingRow,
  ScoreSet,
  SimGroup,
  SimMatch,
  SimPlayer,
  SimTournamentBundle,
} from '@/types/tournament'
import {
  DEMO_SIM_USER_EDGAR_ID,
  DEMO_SIM_USER_ZAIAH_ID,
  orderPlayersCanonically,
} from '@/utils/tournamentSimulation'
import { calculateGroupStandings } from '@/utils/tournamentStandings'
import type { RankingRow } from '@/utils/ranking'

export const MI_TORNEO_DEMO_GROUP_ID = 'mi-torneo-demo-group'

/** Seed 3: usuario real en Supabase (`display_name` demo: nombre corto); 4–5 ficticios. */
export const MI_TORNEO_DEMO_PLAYER3_ID = '6c0d9322-048c-4426-84d8-1a8312b23edf'
const P3 = MI_TORNEO_DEMO_PLAYER3_ID
const P4 = 'a0000004-0000-4000-8000-000000000004'
const P5 = 'a0000005-0000-4000-8000-000000000005'

const Z = DEMO_SIM_USER_ZAIAH_ID
const E = DEMO_SIM_USER_EDGAR_ID

export const miTorneoDemoPlayers: SimPlayer[] = [
  { id: Z, full_name: 'Zaiah', seed_order: 1, group_id: MI_TORNEO_DEMO_GROUP_ID },
  { id: E, full_name: 'Alonso Vazquez', seed_order: 2, group_id: MI_TORNEO_DEMO_GROUP_ID },
  { id: P3, full_name: 'Edgar', seed_order: 3, group_id: MI_TORNEO_DEMO_GROUP_ID },
  { id: P4, full_name: 'Jugador 4', seed_order: 4, group_id: MI_TORNEO_DEMO_GROUP_ID },
  { id: P5, full_name: 'Jugador 5', seed_order: 5, group_id: MI_TORNEO_DEMO_GROUP_ID },
]

function byId(id: string): SimPlayer {
  const p = miTorneoDemoPlayers.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown player ${id}`)
  return p
}

/** Marcador en perspectiva del jugador con menor seed (siempre player A en el partido). */
function matchNormal(
  id: string,
  low: SimPlayer,
  high: SimPlayer,
  scoreFromLowerSeed: ScoreSet[],
  winnerId: string,
): SimMatch {
  const { a: ca, b: cb } = orderPlayersCanonically(low, high)
  return {
    id,
    groupId: MI_TORNEO_DEMO_GROUP_ID,
    playerAId: ca.id,
    playerBId: cb.id,
    resultType: 'normal',
    score: scoreFromLowerSeed,
    winnerId,
    status: 'confirmed',
  }
}

/** Construye los 10 partidos del round robin con resultados fijos. */
function buildDemoMatches(): SimMatch[] {
  const z = byId(Z)
  const e = byId(E)
  const p3 = byId(P3)
  const p4 = byId(P4)
  const p5 = byId(P5)
  return [
    matchNormal('mtd-m-0', z, e, [
      { a: 3, b: 6 },
      { a: 3, b: 6 },
    ], E),
    matchNormal('mtd-m-1', z, p3, [
      { a: 6, b: 4 },
      { a: 6, b: 1 },
    ], Z),
    matchNormal('mtd-m-2', z, p4, [
      { a: 6, b: 0 },
      { a: 6, b: 2 },
    ], Z),
    matchNormal('mtd-m-3', z, p5, [
      { a: 6, b: 2 },
      { a: 6, b: 3 },
    ], Z),
    matchNormal('mtd-m-4', e, p3, [
      { a: 1, b: 6 },
      { a: 5, b: 7 },
    ], P3),
    matchNormal('mtd-m-5', e, p4, [
      { a: 6, b: 0 },
      { a: 6, b: 4 },
    ], E),
    matchNormal('mtd-m-6', e, p5, [
      { a: 3, b: 6 },
      { a: 0, b: 6 },
    ], P5),
    matchNormal('mtd-m-7', p3, p4, [
      { a: 4, b: 6 },
      { a: 1, b: 6 },
    ], P4),
    matchNormal('mtd-m-8', p3, p5, [
      { a: 6, b: 7 },
      { a: 0, b: 6 },
    ], P5),
    matchNormal('mtd-m-9', p4, p5, [
      { a: 6, b: 1 },
      { a: 6, b: 1 },
    ], P4),
  ]
}

const demoGroup: SimGroup = {
  id: MI_TORNEO_DEMO_GROUP_ID,
  name: 'Grupo A',
  order_index: 0,
}

function buildBundle(): SimTournamentBundle {
  const matches = buildDemoMatches()
  const standings = calculateGroupStandings(miTorneoDemoPlayers, matches)

  return {
    tournamentName: 'Torneo Mega Varonil · Grupo de demostración (5 jugadores)',
    groups: [demoGroup],
    playersByGroupId: { [MI_TORNEO_DEMO_GROUP_ID]: miTorneoDemoPlayers },
    matchesByGroupId: { [MI_TORNEO_DEMO_GROUP_ID]: matches },
    standingsByGroupId: { [MI_TORNEO_DEMO_GROUP_ID]: standings },
  }
}

export const miTorneoDemoBundle: SimTournamentBundle = buildBundle()

/** Para `PlayerGroupCard` (UI tipo Supabase). */
export function miTorneoSimPlayersToGroupPlayers(players: SimPlayer[]): GroupPlayer[] {
  return players.map((p) => ({
    id: p.id,
    group_id: p.group_id,
    user_id: p.id,
    display_name: p.full_name,
    seed_order: p.seed_order,
    created_at: new Date(0).toISOString(),
  }))
}

export function groupStandingToRankingRow(row: GroupStandingRow): RankingRow {
  return {
    groupPlayerId: row.playerId,
    userId: row.playerId,
    displayName: row.displayName,
    played: row.played,
    won: row.won,
    lost: row.lost,
    setsFor: row.setsFor,
    setsAgainst: row.setsAgainst,
    gamesFor: row.gamesFor,
    gamesAgainst: row.gamesAgainst,
    points: row.points,
    position: row.position,
  }
}

/** Fila del usuario autenticado (Zaiah / Alonso Vazquez / Edgar seed 3) o, si no coincide, la de Zaiah como ejemplo. */
export function getMiTorneoDemoStandingForUser(authUserId: string | null): GroupStandingRow | null {
  const rows = miTorneoDemoBundle.standingsByGroupId[MI_TORNEO_DEMO_GROUP_ID] ?? []
  if (rows.length === 0) return null
  if (!authUserId) return rows.find((r) => r.playerId === Z) ?? rows[0] ?? null
  return rows.find((r) => r.playerId === authUserId) ?? rows.find((r) => r.playerId === Z) ?? rows[0]!
}
