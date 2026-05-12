import { isMissingPostgrestRelationError } from '@/lib/postgrestErrors'
import { supabase } from '@/lib/supabase'
import { addGroupPlayer, removeGroupPlayer as removeGroupMembership } from '@/services/groups'
import { correctAdminScore, saveMatchScore } from '@/services/matches'
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
  /** Partidos generados que aún esperan marcador. */
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

  if (groupCategories.error && !isMissingPostgrestRelationError(groupCategories.error)) {
    throw groupCategories.error
  }
  const groupCategoriesRows = !groupCategories.error
    ? ((groupCategories.data ?? []) as GroupCategory[])
    : ([] as GroupCategory[])

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
  const matchesWithoutDate = data.matches.filter((m) => m.status === 'pending_score').length
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
    recentMatches: matchRecords.filter((m) => m.score_raw || m.status !== 'pending_score').slice(0, 5),
    pendingActions,
  }
}

/** Conteos por estado de partido para dashboards admin (matches / results / tournaments). */
export type AdminMatchBreakdown = {
  total: number
  pendingScore: number
  withoutDate: number
  scoreSubmitted: number
  scoreDisputed: number
  playerConfirmed: number
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
    pendingScore: matches.filter((m) => m.status === 'pending_score').length,
    withoutDate: matches.filter((m) => m.status === 'pending_score').length,
    scoreSubmitted: matches.filter((m) => m.status === 'score_submitted').length,
    scoreDisputed: matches.filter((m) => m.status === 'score_disputed').length,
    playerConfirmed: matches.filter((m) => m.status === 'player_confirmed').length,
    closed: matches.filter((m) => m.status === 'closed').length,
    cancelled: matches.filter((m) => m.status === 'cancelled').length,
    withOutcome: matches.filter((m) =>
      [
        'score_submitted',
        'score_disputed',
        'player_confirmed',
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

/**
 * Grupos del torneo leyendo solo filas de `groups` / `group_players` / `matches` ligadas a ese torneo.
 * Preferible en `/admin/groups` para no depender de un volcado global de todas las tablas.
 */
export async function getAdminGroupsForTournament(tournamentId: string): Promise<AdminGroupRecord[]> {
  const [{ data: tournament, error: tErr }, { data: groupRows, error: gErr }, { data: categoryRows, error: cErr }] =
    await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tournamentId).maybeSingle(),
      supabase
        .from('groups')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('order_index', { ascending: true }),
      supabase
        .from('group_categories')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('order_index', { ascending: true })
        .order('name', { ascending: true }),
    ])

  if (tErr) throw tErr
  if (gErr) throw gErr
  if (cErr && !isMissingPostgrestRelationError(cErr)) throw cErr

  const groups = (groupRows ?? []) as Group[]
  const categories = (!cErr ? (categoryRows ?? []) : []) as GroupCategory[]
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const groupIds = groups.map((g) => g.id)

  const [{ data: groupPlayers, error: gpErr }, { data: matches, error: mErr }] =
    groupIds.length === 0
      ? [{ data: [] as GroupPlayer[], error: null }, { data: [] as MatchRow[], error: null }]
      : await Promise.all([
          supabase
            .from('group_players')
            .select('*')
            .in('group_id', groupIds)
            .order('seed_order', { ascending: true })
            .order('id', { ascending: true }),
          supabase
            .from('matches')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('created_at', { ascending: false }),
        ])

  if (gpErr) throw gpErr
  if (mErr) throw mErr

  const gpList = (groupPlayers ?? []) as GroupPlayer[]
  const matchList = (matches ?? []) as MatchRow[]
  const userIds = [...new Set(gpList.map((p) => p.user_id))]
  const { data: profilesData, error: pErr } =
    userIds.length === 0
      ? { data: [] as Profile[], error: null }
      : await supabase.from('profiles').select('*').in('id', userIds)

  if (pErr) throw pErr
  const profileById = new Map((profilesData ?? []).map((p) => [p.id, p as Profile]))

  const tournamentObj = tournament as Tournament | null

  if (import.meta.env.DEV) {
    console.log('[getAdminGroupsForTournament]', { tournamentId, groupCount: groups.length })
  }

  return groups.map((group) => ({
    ...group,
    tournament: tournamentObj,
    category: group.group_category_id ? categoryById.get(group.group_category_id) ?? null : null,
    players: gpList
      .filter((player) => player.group_id === group.id)
      .map((player) => ({ ...player, profile: profileById.get(player.user_id) ?? null })),
    matches: matchList.filter((match) => match.group_id === group.id),
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
  if (match.game_type !== 'sudden_death' && !match.score_raw) throw new Error('El partido no tiene marcador para confirmar.')
  if (match.status !== 'player_confirmed') {
    throw new Error('Solo puedes cerrar oficialmente partidos aceptados por el rival.')
  }
  if (match.game_type === 'sudden_death') {
    if (!match.winner_id) throw new Error('El partido no tiene ganador para confirmar.')
    await saveMatchScore({
      match,
      scorePayload: {
        game_type: 'sudden_death',
        score_json: null,
        winner: match.winner_id === match.player_b_id ? 'b' : 'a',
      },
      actorUserId,
      isAdmin: true,
    })
    return
  }
  await saveMatchScore({ match, sets: match.score_raw ?? [], actorUserId, isAdmin: true })
}

export async function correctResult(
  match: MatchRow,
  sets: ScoreSet[],
  actorUserId: string,
  closeAfter = true,
  adminNote?: string,
): Promise<void> {
  await correctAdminScore({ match, sets, actorUserId, closeAfter })
  const note = adminNote?.trim()
  if (note) {
    const { error } = await supabase
      .from('matches')
      .update({ admin_notes: note, updated_by: actorUserId })
      .eq('id', match.id)
    if (error) throw error
  }
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
  patch: Partial<Pick<Profile, 'full_name' | 'email' | 'role' | 'status'>>,
): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw error
}

export async function deactivateUser(userId: string): Promise<void> {
  const { data, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const actorId = data.user?.id ?? null
  if (actorId !== null && actorId === userId) {
    throw new Error('No puedes desactivar tu propia cuenta.')
  }
  const { error } = await supabase.from('profiles').update({ status: 'inactive' }).eq('id', userId)
  if (error) throw error
}

export async function createUser(input: CreateUserInput): Promise<void> {
  void input
  throw new Error('Crear usuarios requiere una Edge Function segura con permisos de servidor.')
}

export async function changeUserPassword(input: ChangePasswordInput): Promise<void> {
  void input
  throw new Error('Cambiar contraseñas requiere una Edge Function segura con permisos de servidor.')
}

export { deleteGroup } from '@/services/groups'
