import { invokeAdminChangeUserPassword, invokeAdminCreateUser } from '@/services/authEdge'
import { isMissingPostgrestRelationError } from '@/lib/postgrestErrors'
import { supabase } from '@/lib/supabase'
import { addGroupPlayer, removeGroupPlayer as removeGroupMembership } from '@/services/groups'
import { adminCorrectDisputedMatch, correctAdminScore, saveMatchScore } from '@/services/matches'
import type {
  Group,
  GroupCategory,
  GroupPlayer,
  MatchRow,
  MatchStatus,
  Profile,
  ScoreSet,
  Tournament,
  TournamentRules,
  TournamentStatus,
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
  categoryName: string
  groupName: string
  playerAName: string
  playerBName: string
  playerAExternalId: string | null
  playerBExternalId: string | null
  playerAUserId: string | null
  playerBUserId: string | null
  /** Nombre legible del perfil que envió el marcador (evita mostrar UUID). */
  scoreSubmittedByLabel: string | null
  opponentConfirmedByLabel: string | null
  /** Quién cerró oficialmente (administración); usa `updated_by` como respaldo si falta validación explícita. */
  closedByLabel: string | null
  /** Perfil legible de quien inició la disputa (refutación). */
  disputedByLabel: string | null
}

export type AdminUserRecord = Profile & {
  group: Group | null
  groupPlayer: GroupPlayer | null
}

export type AdminOverviewPendingAction = {
  message: string
  /** Ruta en administración para revisión o detalle; `null` si no aplica enlace útil. */
  href: string | null
}

export type AdminOverviewData = {
  totalPlayers: number
  totalGroups: number
  /** Total de filas en `matches` visibles para el admin. */
  totalMatches: number
  /** Partidos generados que aún esperan marcador. */
  matchesWithoutDate: number
  /** Partidos del alcance activo con marcador enviado y confirmado (rival aceptó o cierre oficial admin). */
  playedMatches: number
  pendingResults: number
  confirmedResults: number
  incompleteGroups: number
  activeTournaments: number
  totalTournaments: number
  recentMatches: AdminMatchRecord[]
  pendingActions: AdminOverviewPendingAction[]
  /** `all_active`: métricas de todos los torneos con estado activo (legado). `single`: un torneo elegido. */
  scopeMode: 'all_active' | 'single'
  scopedTournamentId: string | null
  scopedTournamentName: string | null
  scopedTournamentStatus: TournamentStatus | null
  /** Torneos «abiertos» (borrador o activo) para texto de ayuda en la UI. */
  openTournamentsDetail: { id: string; name: string; status: TournamentStatus }[]
}

export type CreateUserInput = {
  fullName: string
  phone: string
  temporaryPassword: string
  role: UserRole
  categoryId: string
  groupId?: string
  tournamentId?: string | null
}

export type ChangePasswordInput = {
  userId: string
  newPassword: string
}

/** PostgREST devuelve como máx. ~1000 filas si no se pagina; disputas deben consultarse filtradas en servidor. */
const ADMIN_DISPUTED_MATCHES_LIMIT = 500

async function listAllAdminData() {
  const [tournaments, groups, groupCategories, groupPlayers, matches, profiles] = await Promise.all([
    supabase.from('tournaments').select('*').order('created_at', { ascending: false }),
    supabase.from('groups').select('*').order('order_index', { ascending: true }),
    supabase.from('group_categories').select('*').order('order_index', { ascending: true }),
    supabase.from('group_players').select('*').order('seed_order', { ascending: true }),
    supabase.from('matches').select('*').order('created_at', { ascending: false }).limit(5000),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(4000),
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

function profileDisplayLabel(profileById: Map<string, Profile>, userId: string | null | undefined): string | null {
  if (!userId) return null
  const p = profileById.get(userId)
  if (!p) return `Usuario (${userId.slice(0, 8)}…)`
  const name = p.full_name?.trim()
  if (name) return name
  const email = p.email?.trim()
  if (email) return email
  const phone = p.phone?.trim()
  if (phone) return phone
  return `Usuario (${userId.slice(0, 8)}…)`
}

function groupPlayerDisplayLabel(
  player: GroupPlayer | null | undefined,
  profile: Profile | null | undefined,
): string | null {
  const displayName = player?.display_name?.trim()
  if (displayName) return displayName
  const fullName = profile?.full_name?.trim()
  if (fullName) return fullName
  const email = profile?.email?.trim()
  if (email) return email
  const phone = profile?.phone?.trim()
  if (phone) return phone
  return null
}

function buildMatchRecords(input: {
  matches: MatchRow[]
  tournaments: Tournament[]
  groups: Group[]
  groupCategories: GroupCategory[]
  groupPlayers: GroupPlayer[]
  profiles: Profile[]
}): AdminMatchRecord[] {
  const tournamentById = new Map(input.tournaments.map((t) => [t.id, t]))
  const groupById = new Map(input.groups.map((g) => [g.id, g]))
  const categoryById = new Map(input.groupCategories.map((c) => [c.id, c]))
  const groupPlayerById = new Map(input.groupPlayers.map((p) => [p.id, p]))
  const profileById = new Map(input.profiles.map((p) => [p.id, p]))

  return input.matches.map((match) => {
    const group = groupById.get(match.group_id)
    const playerA = groupPlayerById.get(match.player_a_id)
    const playerB = groupPlayerById.get(match.player_b_id)
    const profileA = playerA ? profileById.get(playerA.user_id) : null
    const profileB = playerB ? profileById.get(playerB.user_id) : null
    const playerALabel = groupPlayerDisplayLabel(playerA, profileA) ?? 'Jugador sin perfil'
    const playerBLabel = groupPlayerDisplayLabel(playerB, profileB) ?? 'Jugador sin perfil'

    const disputedByLabel = (() => {
      const profileLabel = profileDisplayLabel(profileById, match.disputed_by)
      if (profileLabel && !profileLabel.startsWith('Usuario (')) return profileLabel
      if (match.disputed_by === playerA?.user_id) return playerALabel
      if (match.disputed_by === playerB?.user_id) return playerBLabel
      if (match.updated_by === playerA?.user_id) return playerALabel
      if (match.updated_by === playerB?.user_id) return playerBLabel
      if (!match.disputed_by && match.score_submitted_by === playerA?.user_id) return playerBLabel
      if (!match.disputed_by && match.score_submitted_by === playerB?.user_id) return playerALabel
      if (!match.disputed_by && !match.score_submitted_by) return playerBLabel
      return profileLabel
    })()

    return {
      ...match,
      tournamentName: tournamentById.get(match.tournament_id)?.name ?? 'No disponible',
      categoryName: group?.group_category_id ? categoryById.get(group.group_category_id)?.name ?? '' : '',
      groupName: group?.name ?? 'No disponible',
      playerAName: playerALabel,
      playerBName: playerBLabel,
      playerAExternalId: profileA?.external_id?.trim() || null,
      playerBExternalId: profileB?.external_id?.trim() || null,
      playerAUserId: playerA?.user_id ?? null,
      playerBUserId: playerB?.user_id ?? null,
      scoreSubmittedByLabel: profileDisplayLabel(profileById, match.score_submitted_by),
      opponentConfirmedByLabel: profileDisplayLabel(profileById, match.opponent_confirmed_by),
      closedByLabel:
        match.status === 'closed' || match.status === 'validated'
          ? profileDisplayLabel(profileById, match.admin_validated_by ?? match.updated_by)
          : null,
      disputedByLabel,
    }
  })
}

function openTournamentsFromData(tournaments: Tournament[]): { id: string; name: string; status: TournamentStatus }[] {
  return tournaments
    .filter((t) => t.status === 'draft' || t.status === 'active')
    .map((t) => ({ id: t.id, name: t.name, status: t.status }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
}

function adminGroupsHref(tournamentIdForScope: string | null): string {
  if (!tournamentIdForScope) return '/admin/groups'
  return `/admin/groups?${new URLSearchParams({ tournament: tournamentIdForScope }).toString()}`
}

function adminMatchesHref(tournamentIdForScope: string | null): string {
  if (!tournamentIdForScope) return '/admin/matches'
  return `/admin/matches?${new URLSearchParams({ tournament: tournamentIdForScope }).toString()}`
}

/** Torneo único para construir enlaces cuando el alcance es inequívoco. */
function scopeTournamentIdForAdminLinks(
  scopedTournamentId: string | null,
  options: { scopeMode: 'all_active' | 'single'; activeTournamentsList: Tournament[] },
): string | null {
  if (scopedTournamentId) return scopedTournamentId
  if (options.scopeMode === 'all_active' && options.activeTournamentsList.length === 1) {
    return options.activeTournamentsList[0].id
  }
  return null
}

function buildAdminOverviewScoped(
  data: Awaited<ReturnType<typeof listAllAdminData>>,
  scopeIds: Set<string>,
  options: {
    scopeMode: 'all_active' | 'single'
    /** Para copy de pendientes en modo all_active. */
    activeTournamentsList: Tournament[]
    /** Torneo único en modo single (validado). */
    singleTournament: Tournament | null
  },
): AdminOverviewData {
  const openDetail = openTournamentsFromData(data.tournaments)
  const activeCount = data.tournaments.filter((t) => t.status === 'active').length

  if (scopeIds.size === 0) {
    const pending: AdminOverviewPendingAction[] =
      options.scopeMode === 'single' && options.singleTournament
        ? [
            {
              message: `No hay datos operativos para «${options.singleTournament.name}» (sin grupos/partidos o torneo inexistente en el alcance).`,
              href: '/admin/tournaments',
            },
          ]
        : [
            {
              message:
                'No hay ningún torneo activo. Activa un torneo en Administración → Torneos para ver métricas del torneo en curso.',
              href: '/admin/tournaments',
            },
          ]

    return {
      totalPlayers: 0,
      totalGroups: 0,
      totalMatches: 0,
      matchesWithoutDate: 0,
      playedMatches: 0,
      pendingResults: 0,
      confirmedResults: 0,
      incompleteGroups: 0,
      activeTournaments: activeCount,
      totalTournaments: data.tournaments.length,
      recentMatches: [],
      pendingActions: pending,
      scopeMode: options.scopeMode,
      scopedTournamentId: options.singleTournament?.id ?? null,
      scopedTournamentName: options.singleTournament?.name ?? null,
      scopedTournamentStatus: options.singleTournament?.status ?? null,
      openTournamentsDetail: openDetail,
    }
  }

  const scopedGroups = data.groups.filter((g) => scopeIds.has(g.tournament_id))
  const scopedGroupIds = new Set(scopedGroups.map((g) => g.id))
  const scopedMatches = data.matches.filter((m) => scopeIds.has(m.tournament_id))

  const playerCounts = new Map<string, number>()
  for (const player of data.groupPlayers) {
    if (!scopedGroupIds.has(player.group_id)) continue
    playerCounts.set(player.group_id, (playerCounts.get(player.group_id) ?? 0) + 1)
  }

  const distinctPlayers = new Set<string>()
  for (const player of data.groupPlayers) {
    if (scopedGroupIds.has(player.group_id)) distinctPlayers.add(player.user_id)
  }

  const matchRecords = buildMatchRecords({
    matches: scopedMatches,
    tournaments: data.tournaments,
    groups: data.groups,
    groupCategories: data.groupCategories,
    groupPlayers: data.groupPlayers,
    profiles: data.profiles,
  })

  const pendingResults = scopedMatches.filter((m) =>
    ['player_confirmed', 'score_disputed'].includes(m.status),
  ).length
  const totalMatches = scopedMatches.length
  const matchesWithoutDate = scopedMatches.filter((m) =>
    m.status === 'pending_score' || m.status === 'score_disputed'
  ).length
  const incompleteGroups = scopedGroups.filter((g) => (playerCounts.get(g.id) ?? 0) < g.max_players).length

  const scopedTournamentId = options.singleTournament?.id ?? null
  const linkTournamentId = scopeTournamentIdForAdminLinks(scopedTournamentId, {
    scopeMode: options.scopeMode,
    activeTournamentsList: options.activeTournamentsList,
  })

  const pendingActions: AdminOverviewPendingAction[] = []
  if (options.scopeMode === 'all_active' && options.activeTournamentsList.length > 1) {
    pendingActions.push({
      message: `Hay ${options.activeTournamentsList.length} torneos activos; estas métricas suman todos ellos. Usa Vista general para filtrar un torneo.`,
      href: '/admin/overview',
    })
  }
  if (incompleteGroups > 0) {
    pendingActions.push({
      message: `${incompleteGroups} grupos requieren jugadores`,
      href: adminGroupsHref(linkTournamentId),
    })
  }
  if (pendingResults > 0) {
    pendingActions.push({
      message: `${pendingResults} resultados esperan revisión`,
      href: adminMatchesHref(linkTournamentId),
    })
  }

  const scopedTournamentName = options.singleTournament?.name ?? null
  const scopedTournamentStatus = options.singleTournament?.status ?? null

  return {
    totalPlayers: distinctPlayers.size,
    totalGroups: scopedGroups.length,
    totalMatches,
    matchesWithoutDate,
    playedMatches: scopedMatches.filter((m) =>
      ['player_confirmed', 'closed', 'validated'].includes(m.status),
    ).length,
    pendingResults,
    confirmedResults: scopedMatches.filter((m) => m.status === 'closed' || m.status === 'validated').length,
    incompleteGroups,
    activeTournaments: activeCount,
    totalTournaments: data.tournaments.length,
    recentMatches: matchRecords.filter((m) => m.score_raw || m.status !== 'pending_score').slice(0, 5),
    pendingActions,
    scopeMode: options.scopeMode,
    scopedTournamentId,
    scopedTournamentName,
    scopedTournamentStatus,
    openTournamentsDetail: openDetail,
  }
}

export async function getAdminOverviewData(tournamentId?: string | null): Promise<AdminOverviewData> {
  const data = await listAllAdminData()
  const tid = tournamentId?.trim() || ''

  if (tid) {
    const tournament = data.tournaments.find((t) => t.id === tid)
    if (!tournament) {
      throw new Error('Torneo no encontrado.')
    }
    const scopeIds = new Set<string>([tournament.id])
    return buildAdminOverviewScoped(data, scopeIds, {
      scopeMode: 'single',
      activeTournamentsList: [],
      singleTournament: tournament,
    })
  }

  const activeTournamentsList = data.tournaments.filter((t) => t.status === 'active')
  const activeIds = new Set(activeTournamentsList.map((t) => t.id))

  return buildAdminOverviewScoped(data, activeIds, {
    scopeMode: 'all_active',
    activeTournamentsList,
    singleTournament: null,
  })
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
  const pendingOperational = matches.filter((m) =>
    m.status === 'pending_score' || m.status === 'score_disputed'
  ).length
  return {
    total: matches.length,
    pendingScore: pendingOperational,
    withoutDate: pendingOperational,
    scoreSubmitted: matches.filter((m) => m.status === 'score_submitted').length,
    scoreDisputed: matches.filter((m) => m.status === 'score_disputed').length,
    playerConfirmed: matches.filter((m) => m.status === 'player_confirmed').length,
    closed: matches.filter((m) => m.status === 'closed' || m.status === 'validated').length,
    cancelled: matches.filter((m) => m.status === 'cancelled').length,
    withOutcome: matches.filter((m) =>
      ['score_submitted', 'score_disputed', 'player_confirmed', 'closed', 'validated'].includes(m.status),
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
    const allowed = filters.groupId.split('|').filter(Boolean)
    records = records.filter((match) => allowed.includes(match.group_id))
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

async function fetchAdminContextForMatches(matchRows: MatchRow[]) {
  if (matchRows.length === 0) {
    return {
      tournaments: [] as Tournament[],
      groups: [] as Group[],
      groupCategories: [] as GroupCategory[],
      groupPlayers: [] as GroupPlayer[],
      profiles: [] as Profile[],
    }
  }

  const tournamentIds = [...new Set(matchRows.map((m) => m.tournament_id))]
  const groupIds = [...new Set(matchRows.map((m) => m.group_id))]
  const groupPlayerIds = [...new Set(matchRows.flatMap((m) => [m.player_a_id, m.player_b_id]))]
  const profileIds = new Set<string>()
  for (const match of matchRows) {
    if (match.score_submitted_by) profileIds.add(match.score_submitted_by)
    if (match.disputed_by) profileIds.add(match.disputed_by)
    if (match.opponent_confirmed_by) profileIds.add(match.opponent_confirmed_by)
    if (match.admin_validated_by) profileIds.add(match.admin_validated_by)
    if (match.updated_by) profileIds.add(match.updated_by)
  }

  const [tournaments, groups, groupCategories, groupPlayers] = await Promise.all([
    supabase.from('tournaments').select('*').in('id', tournamentIds),
    supabase.from('groups').select('*').in('id', groupIds),
    supabase.from('group_categories').select('*').in('tournament_id', tournamentIds).order('order_index', { ascending: true }),
    supabase.from('group_players').select('*').in('id', groupPlayerIds),
  ])

  const contextError =
    tournaments.error || groups.error || groupPlayers.error
  if (contextError) throw contextError
  if (groupCategories.error && !isMissingPostgrestRelationError(groupCategories.error)) {
    throw groupCategories.error
  }

  const groupPlayersRows = (groupPlayers.data ?? []) as GroupPlayer[]
  for (const player of groupPlayersRows) {
    profileIds.add(player.user_id)
  }

  const profileIdList = [...profileIds]
  const profiles =
    profileIdList.length > 0
      ? await supabase.from('profiles').select('*').in('id', profileIdList)
      : { data: [] as Profile[], error: null }
  if (profiles.error) throw profiles.error

  return {
    tournaments: (tournaments.data ?? []) as Tournament[],
    groups: (groups.data ?? []) as Group[],
    groupCategories: !groupCategories.error
      ? ((groupCategories.data ?? []) as GroupCategory[])
      : ([] as GroupCategory[]),
    groupPlayers: groupPlayersRows,
    profiles: (profiles.data ?? []) as Profile[],
  }
}

/** Bandeja de disputas: consulta server-side para no perder refutaciones tras el límite global de partidos. */
export async function getAdminDisputedResults(): Promise<AdminMatchRecord[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'score_disputed')
    .order('disputed_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(ADMIN_DISPUTED_MATCHES_LIMIT)
  if (error) throw error

  const matchRows = (data ?? []) as MatchRow[]
  const context = await fetchAdminContextForMatches(matchRows)
  return buildMatchRecords({ matches: matchRows, ...context })
}

export async function confirmResult(match: MatchRow, actorUserId: string): Promise<void> {
  if (match.status === 'closed' || match.status === 'validated') return
  if (match.status === 'cancelled') throw new Error('No se puede confirmar un partido cancelado.')
  if (match.game_type !== 'sudden_death' && !match.score_raw) throw new Error('El partido no tiene marcador para confirmar.')
  if (match.game_type === 'sudden_death') {
    if (!match.winner_id) throw new Error('El partido no tiene ganador para confirmar.')
    const three = match.score_raw?.length === 3 ? match.score_raw : null
    await saveMatchScore({
      match,
      scorePayload: {
        game_type: 'sudden_death',
        score_json: three,
        winner: match.winner_id === match.player_b_id ? 'b' : 'a',
      },
      actorUserId,
      isAdmin: true,
      adminStatus: 'closed',
    })
    return
  }
  await saveMatchScore({
    match,
    sets: match.score_raw ?? [],
    actorUserId,
    isAdmin: true,
    adminStatus: 'closed',
  })
}

export async function correctResult(
  match: MatchRow,
  sets: ScoreSet[],
  actorUserId: string,
  closeAfter = true,
  adminNote?: string,
  rules?: TournamentRules | null,
): Promise<void> {
  if (match.status === 'score_disputed') {
    if (!closeAfter) {
      throw new Error('En un partido refutado solo puedes validar o corregir y validar el marcador.')
    }
    await adminCorrectDisputedMatch({ match, sets, rules })
  } else {
    await correctAdminScore({ match, sets, actorUserId, closeAfter })
  }
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
  patch: Partial<Pick<Profile, 'full_name' | 'role' | 'status' | 'category_id'>>,
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
  await invokeAdminCreateUser(input)
}

export async function changeUserPassword(input: ChangePasswordInput): Promise<void> {
  await invokeAdminChangeUserPassword({ userId: input.userId, newPassword: input.newPassword })
}

export { deleteGroup } from '@/services/groups'
