import { supabase } from '@/lib/supabase'
import { addGroupPlayer, removeGroupPlayer as removeGroupMembership } from '@/services/groups'
import { saveMatchScore, updateMatchSchedule, type MatchSchedulePatch } from '@/services/matches'
import type {
  Group,
  GroupCategory,
  GroupPlayer,
  MatchRow,
  MatchStatus,
  Profile,
  ScoreSet,
  Tournament,
  UserRole,
} from '@/types/database'

export type AdminGroupPlayer = GroupPlayer & {
  profile: Profile | null
}

export type AdminGroupRecord = Group & {
  tournament: Tournament | null
  category: GroupCategory | null
  players: AdminGroupPlayer[]
  matches: MatchRow[]
}

export type AdminMatchRecord = MatchRow & {
  tournamentName: string
  groupName: string
  playerAName: string
  playerBName: string
}

export type AdminUserRecord = Profile & {
  group: Group | null
  groupPlayer: GroupPlayer | null
}

export type AdminOverviewData = {
  totalPlayers: number
  totalGroups: number
  /** Total de filas en `matches` visibles para el admin. */
  totalMatches: number
  /** Partidos sin `scheduled_date` (útil para detectar agenda incompleta). */
  matchesWithoutDate: number
  playedMatches: number
  pendingResults: number
  confirmedResults: number
  incompleteGroups: number
  activeTournaments: number
  totalTournaments: number
  recentMatches: AdminMatchRecord[]
  pendingActions: string[]
}

export type CreateUserInput = {
  fullName: string
  email: string
  temporaryPassword: string
  role: UserRole
  groupId?: string
}

export type ChangePasswordInput = {
  userId: string
  newPassword: string
}

async function listAllAdminData() {
  const [tournaments, groups, groupCategories, groupPlayers, matches, profiles] = await Promise.all([
    supabase.from('tournaments').select('*').order('created_at', { ascending: false }),
    supabase.from('groups').select('*').order('order_index', { ascending: true }),
    supabase.from('group_categories').select('*').order('order_index', { ascending: true }),
    supabase.from('group_players').select('*').order('seed_order', { ascending: true }),
    supabase.from('matches').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(500),
  ])

  const error = tournaments.error || groups.error || groupPlayers.error || matches.error
  if (error) throw error

  // `group_categories` puede no existir si la migración aún no se aplicó: no bloquear todo el admin.
  const groupCategoriesRows = groupCategories.error
    ? ([] as GroupCategory[])
    : ((groupCategories.data ?? []) as GroupCategory[])

  return {
    tournaments: (tournaments.data ?? []) as Tournament[],
    groups: (groups.data ?? []) as Group[],
    groupCategories: groupCategoriesRows,
    groupPlayers: (groupPlayers.data ?? []) as GroupPlayer[],
    matches: (matches.data ?? []) as MatchRow[],
    profiles: profiles.error ? [] : ((profiles.data ?? []) as Profile[]),
  }
}

function buildMatchRecords(input: {
  matches: MatchRow[]
  tournaments: Tournament[]
  groups: Group[]
  groupPlayers: GroupPlayer[]
  profiles: Profile[]
}): AdminMatchRecord[] {
  const tournamentById = new Map(input.tournaments.map((t) => [t.id, t]))
  const groupById = new Map(input.groups.map((g) => [g.id, g]))
  const groupPlayerById = new Map(input.groupPlayers.map((p) => [p.id, p]))
  const profileById = new Map(input.profiles.map((p) => [p.id, p]))

  return input.matches.map((match) => {
    const playerA = groupPlayerById.get(match.player_a_id)
    const playerB = groupPlayerById.get(match.player_b_id)
    const profileA = playerA ? profileById.get(playerA.user_id) : null
    const profileB = playerB ? profileById.get(playerB.user_id) : null

    return {
      ...match,
      tournamentName: tournamentById.get(match.tournament_id)?.name ?? 'No disponible',
      groupName: groupById.get(match.group_id)?.name ?? 'No disponible',
      playerAName: playerA?.display_name ?? profileA?.full_name ?? profileA?.email ?? 'Jugador sin perfil',
      playerBName: playerB?.display_name ?? profileB?.full_name ?? profileB?.email ?? 'Jugador sin perfil',
    }
  })
}

export async function getAdminOverviewData(): Promise<AdminOverviewData> {
  const data = await listAllAdminData()
  const matchRecords = buildMatchRecords(data)
  const playerCounts = new Map<string, number>()

  for (const player of data.groupPlayers) {
    playerCounts.set(player.group_id, (playerCounts.get(player.group_id) ?? 0) + 1)
  }

  const pendingResults = data.matches.filter((m) =>
    ['player_confirmed', 'score_disputed'].includes(m.status),
  ).length
  const totalMatches = data.matches.length
  const matchesWithoutDate = data.matches.filter((m) => !m.scheduled_date).length
  const incompleteGroups = data.groups.filter((g) => (playerCounts.get(g.id) ?? 0) < g.max_players).length

  const pendingActions: string[] = []
  if (incompleteGroups > 0) pendingActions.push(`${incompleteGroups} grupos requieren jugadores`)
  if (pendingResults > 0) pendingActions.push(`${pendingResults} resultados esperan revisión`)

  return {
    totalPlayers: data.profiles.filter((p) => p.role === 'player').length,
    totalGroups: data.groups.length,
    totalMatches,
    matchesWithoutDate,
    playedMatches: data.matches.filter((m) => m.status === 'closed').length,
    pendingResults,
    confirmedResults: data.matches.filter((m) => m.status === 'closed').length,
    incompleteGroups,
    activeTournaments: data.tournaments.filter((t) => t.status === 'active').length,
    totalTournaments: data.tournaments.length,
    recentMatches: matchRecords.filter((m) => m.score_raw || m.scheduled_date).slice(0, 5),
    pendingActions,
  }
}

/** Conteos por estado de partido para dashboards admin (matches / results / tournaments). */
export type AdminMatchBreakdown = {
  total: number
  scheduled: number
  withoutDate: number
  readyForScore: number
  scoreSubmitted: number
  scoreDisputed: number
  playerConfirmed: number
  adminValidated: number
  closed: number
  cancelled: number
  /** Marcador en curso o cerrado (excl. cancelados sin juego). */
  withOutcome: number
  /** W/O u otros tipos distintos de partido normal. */
  defaultResults: number
  /** Cola sugerida para admin (validar / controversia). */
  needsAdminAttention: number
}

export function computeAdminMatchBreakdown(matches: MatchRow[]): AdminMatchBreakdown {
  const needsAdminAttention = matches.filter((m) =>
    ['player_confirmed', 'score_disputed'].includes(m.status),
  ).length
  return {
    total: matches.length,
    scheduled: matches.filter((m) => m.status === 'scheduled').length,
    withoutDate: matches.filter((m) => !m.scheduled_date).length,
    readyForScore: matches.filter((m) => m.status === 'ready_for_score').length,
    scoreSubmitted: matches.filter((m) => m.status === 'score_submitted').length,
    scoreDisputed: matches.filter((m) => m.status === 'score_disputed').length,
    playerConfirmed: matches.filter((m) => m.status === 'player_confirmed').length,
    adminValidated: matches.filter((m) => m.status === 'admin_validated').length,
    closed: matches.filter((m) => m.status === 'closed').length,
    cancelled: matches.filter((m) => m.status === 'cancelled').length,
    withOutcome: matches.filter((m) =>
      [
        'score_submitted',
        'score_disputed',
        'player_confirmed',
        'admin_validated',
        'closed',
      ].includes(m.status),
    ).length,
    defaultResults: matches.filter((m) => m.result_type !== 'normal').length,
    needsAdminAttention,
  }
}

export async function getAdminGroups(tournamentId?: string): Promise<AdminGroupRecord[]> {
  const data = await listAllAdminData()
  const tournamentById = new Map(data.tournaments.map((t) => [t.id, t]))
  const categoryById = new Map(data.groupCategories.map((c) => [c.id, c]))
  const profileById = new Map(data.profiles.map((p) => [p.id, p]))
  const groups = tournamentId
    ? data.groups.filter((group) => group.tournament_id === tournamentId)
    : data.groups

  return groups.map((group) => ({
    ...group,
    tournament: tournamentById.get(group.tournament_id) ?? null,
    category: group.group_category_id ? categoryById.get(group.group_category_id) ?? null : null,
    players: data.groupPlayers
      .filter((player) => player.group_id === group.id)
      .map((player) => ({ ...player, profile: profileById.get(player.user_id) ?? null })),
    matches: data.matches.filter((match) => match.group_id === group.id),
  }))
}

export async function updateGroup(
  groupId: string,
  patch: Partial<Pick<Group, 'name' | 'order_index' | 'max_players' | 'group_category_id'>>,
): Promise<void> {
  const { error } = await supabase.from('groups').update(patch).eq('id', groupId)
  if (error) throw error
}

export async function assignPlayerToGroup(input: {
  groupId: string
  userId: string
  displayName: string
  seedOrder?: number
}): Promise<GroupPlayer> {
  return addGroupPlayer(input)
}

export async function removePlayerFromGroup(groupPlayerId: string): Promise<void> {
  return removeGroupMembership(groupPlayerId)
}

export async function getAdminMatches(filters?: {
  groupId?: string
  status?: MatchStatus | 'all'
}): Promise<AdminMatchRecord[]> {
  const data = await listAllAdminData()
  let records = buildMatchRecords(data)

  if (filters?.groupId && filters.groupId !== 'all') {
    records = records.filter((match) => match.group_id === filters.groupId)
  }
  if (filters?.status && filters.status !== 'all') {
    records = records.filter((match) => match.status === filters.status)
  }
  return records
}

export async function scheduleMatch(
  matchId: string,
  patch: MatchSchedulePatch,
  actorId: string,
): Promise<void> {
  return updateMatchSchedule(matchId, patch, actorId)
}

export async function updateMatchStatus(
  matchId: string,
  status: MatchStatus,
  actorId: string,
): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status, updated_by: actorId })
    .eq('id', matchId)
  if (error) throw error
}

export async function getAdminResults(): Promise<AdminMatchRecord[]> {
  return getAdminMatches()
}

export async function confirmResult(match: MatchRow, actorUserId: string): Promise<void> {
  if (!match.score_raw) throw new Error('El partido no tiene marcador para confirmar.')
  if (match.status !== 'player_confirmed') {
    throw new Error('Solo puedes cerrar oficialmente partidos aceptados por el rival.')
  }
  await saveMatchScore({ match, sets: match.score_raw, actorUserId, isAdmin: true })
}

export async function correctResult(
  match: MatchRow,
  sets: ScoreSet[],
  actorUserId: string,
): Promise<void> {
  await saveMatchScore({ match, sets, actorUserId, isAdmin: true })
}

export async function getAdminUsers(): Promise<AdminUserRecord[]> {
  const data = await listAllAdminData()
  const groupById = new Map(data.groups.map((g) => [g.id, g]))
  const membershipByUserId = new Map<string, GroupPlayer>()

  for (const membership of data.groupPlayers) {
    if (!membershipByUserId.has(membership.user_id)) {
      membershipByUserId.set(membership.user_id, membership)
    }
  }

  return data.profiles.map((profile) => {
    const groupPlayer = membershipByUserId.get(profile.id) ?? null
    return {
      ...profile,
      groupPlayer,
      group: groupPlayer ? groupById.get(groupPlayer.group_id) ?? null : null,
    }
  })
}

export async function updateUser(
  userId: string,
  patch: Partial<Pick<Profile, 'full_name' | 'email' | 'role'>>,
): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw error
}

export async function deactivateUser(userId: string): Promise<void> {
  throw new Error(
    `La desactivación de ${userId} requiere una columna de estado o una Edge Function segura.`,
  )
}

export async function createUser(input: CreateUserInput): Promise<void> {
  void input
  throw new Error('Crear usuarios requiere una Edge Function segura con permisos de servidor.')
}

export async function changeUserPassword(input: ChangePasswordInput): Promise<void> {
  void input
  throw new Error('Cambiar contraseñas requiere una Edge Function segura con permisos de servidor.')
}
