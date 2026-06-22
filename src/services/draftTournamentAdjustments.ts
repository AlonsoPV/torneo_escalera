import { supabase } from '@/lib/supabase'
import { getAdminGroupsForTournament, type AdminGroupRecord, type AdminGroupPlayer } from '@/services/admin'
import { generateRoundRobinMatches } from '@/services/matches'
import { getTournament, updateTournament } from '@/services/tournaments'
import type { TournamentMovementType } from '@/types/database'

const DEFAULT_GROUP_SIZE = 5

export type DraftGroupBalanceStatus = 'ok' | 'missing_players' | 'too_many_players'

export type DraftGroupBalanceRow = {
  groupId: string
  groupName: string
  playerCount: number
  status: DraftGroupBalanceStatus
  difference: number
}

export type DraftRebalanceMove = {
  playerId: string
  groupPlayerId: string
  playerName: string
  currentGroupId: string
  currentGroupName: string
  destinationGroupId: string
  destinationGroupName: string
  type: 'rebalance_up' | 'rebalance_down'
  motive: string
  isLocked: boolean
  entryType: string
}

type WorkPlayer = AdminGroupPlayer
type WorkGroup = AdminGroupRecord & { workPlayers: WorkPlayer[] }

function sortGroups(groups: AdminGroupRecord[]) {
  return [...groups].sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name, 'es', { numeric: true }))
}

function sortBestAvailable(players: WorkPlayer[]) {
  return [...players].sort((a, b) => a.seed_order - b.seed_order || a.display_name.localeCompare(b.display_name, 'es'))
}

function sortWorstAvailable(players: WorkPlayer[]) {
  return [...players].sort((a, b) => b.seed_order - a.seed_order || b.display_name.localeCompare(a.display_name, 'es'))
}

function toBalanceRow(group: AdminGroupRecord, groupSize = DEFAULT_GROUP_SIZE): DraftGroupBalanceRow {
  const diff = group.players.length - groupSize
  return {
    groupId: group.id,
    groupName: group.name,
    playerCount: group.players.length,
    status: diff === 0 ? 'ok' : diff < 0 ? 'missing_players' : 'too_many_players',
    difference: diff,
  }
}

function ensureDraftTournament(groups: AdminGroupRecord[]) {
  const tournament = groups[0]?.tournament
  if (!tournament) throw new Error('No se encontró el torneo seleccionado.')
  if (tournament.status !== 'draft') {
    throw new Error('Estos ajustes solo se pueden hacer en un torneo borrador.')
  }
  return tournament
}

export async function validateDraftTournamentBalance(
  tournamentId: string,
  groupSize = DEFAULT_GROUP_SIZE,
): Promise<DraftGroupBalanceRow[]> {
  const groups = await getAdminGroupsForTournament(tournamentId)
  return sortGroups(groups).map((group) => toBalanceRow(group, groupSize))
}

export async function previewDraftTournamentRebalance(
  tournamentId: string,
  groupSize = DEFAULT_GROUP_SIZE,
): Promise<{ balance: DraftGroupBalanceRow[]; moves: DraftRebalanceMove[]; conflicts: string[] }> {
  const groups = sortGroups(await getAdminGroupsForTournament(tournamentId))
  if (groups.length === 0) return { balance: [], moves: [], conflicts: [] }
  ensureDraftTournament(groups)

  const workGroups: WorkGroup[] = groups.map((group) => ({
    ...group,
    workPlayers: [...group.players],
  }))
  const moves: DraftRebalanceMove[] = []
  const conflicts: string[] = []

  const movePlayer = (fromIndex: number, toIndex: number, player: WorkPlayer, type: DraftRebalanceMove['type'], motive: string) => {
    const from = workGroups[fromIndex]!
    const to = workGroups[toIndex]!
    from.workPlayers = from.workPlayers.filter((p) => p.id !== player.id)
    to.workPlayers.push(player)
    moves.push({
      playerId: player.user_id,
      groupPlayerId: player.id,
      playerName: player.display_name,
      currentGroupId: from.id,
      currentGroupName: from.name,
      destinationGroupId: to.id,
      destinationGroupName: to.name,
      type,
      motive,
      isLocked: player.is_locked ?? false,
      entryType: player.entry_type ?? 'carryover',
    })
  }

  for (let i = 0; i < workGroups.length; i += 1) {
    while (workGroups[i]!.workPlayers.length > groupSize) {
      const player = sortWorstAvailable(workGroups[i]!.workPlayers.filter((p) => !p.is_locked))[0]
      if (!player) {
        conflicts.push(`«${workGroups[i]!.name}» tiene exceso, pero todos sus jugadores están fijos.`)
        break
      }
      if (i + 1 >= workGroups.length) {
        conflicts.push(`«${workGroups[i]!.name}» tiene exceso y no existe un grupo inferior para mover jugadores.`)
        break
      }
      movePlayer(i, i + 1, player, 'rebalance_down', 'Exceso de cupo: baja el peor seed disponible no fijo.')
    }
  }

  for (let i = 0; i < workGroups.length; i += 1) {
    while (workGroups[i]!.workPlayers.length < groupSize) {
      let moved = false
      for (let j = i + 1; j < workGroups.length; j += 1) {
        const candidate = sortBestAvailable(workGroups[j]!.workPlayers.filter((p) => !p.is_locked))[0]
        if (!candidate) continue
        movePlayer(j, i, candidate, 'rebalance_up', 'Vacante detectada: sube el mejor seed disponible no fijo.')
        moved = true
        break
      }
      if (!moved) {
        conflicts.push(`«${workGroups[i]!.name}» tiene vacante y no hay jugadores no fijos disponibles abajo.`)
        break
      }
    }
  }

  const balance = workGroups.map((group) =>
    toBalanceRow({ ...group, players: group.workPlayers }, groupSize),
  )

  return { balance, moves, conflicts }
}

export async function applyDraftTournamentRebalance(input: {
  tournamentId: string
  adminId: string
  groupSize?: number
}): Promise<{ movesApplied: number; balance: DraftGroupBalanceRow[] }> {
  const groupSize = input.groupSize ?? DEFAULT_GROUP_SIZE
  const preview = await previewDraftTournamentRebalance(input.tournamentId, groupSize)
  if (preview.conflicts.length > 0) throw new Error(preview.conflicts[0])
  if (preview.moves.length === 0) return { movesApplied: 0, balance: preview.balance }

  const tournament = await getTournament(input.tournamentId)
  if (!tournament) throw new Error('Torneo no encontrado.')
  if (tournament.status !== 'draft') throw new Error('Solo se puede rebalancear un torneo borrador.')
  const fromTournamentId = tournament.previous_tournament_id ?? tournament.id
  const now = new Date().toISOString()

  for (const move of preview.moves) {
    const destination = await supabase
      .from('group_players')
      .select('id')
      .eq('group_id', move.destinationGroupId)
    if (destination.error) throw destination.error
    const nextSeed = (destination.data ?? []).length + 1
    const { error } = await supabase
      .from('group_players')
      .update({ group_id: move.destinationGroupId, seed_order: nextSeed })
      .eq('id', move.groupPlayerId)
    if (error) throw error
  }

  const movementRows = preview.moves.map((move) => ({
    from_tournament_id: fromTournamentId,
    to_tournament_id: input.tournamentId,
    player_id: move.playerId,
    from_group_id: move.currentGroupId,
    to_group_id: move.destinationGroupId,
    from_position: 0,
    points: 0,
    games_for: 0,
    games_difference: 0,
    movement_type: move.type as TournamentMovementType,
    movement_reason: null,
    raw_movement: JSON.stringify({ motive: move.motive, source: 'draft_rebalance' }),
    applied_by_admin_id: input.adminId,
    applied_at: now,
  }))

  const { error: movErr } = await supabase.from('tournament_movements').insert(movementRows)
  if (movErr) throw movErr

  return {
    movesApplied: preview.moves.length,
    balance: await validateDraftTournamentBalance(input.tournamentId, groupSize),
  }
}

export async function recordDraftPlayerRemoval(input: {
  groupPlayerId: string
  adminId: string
}): Promise<void> {
  const { data, error } = await supabase
    .from('group_players')
    .select('*, group:groups(*, tournament:tournaments(*))')
    .eq('id', input.groupPlayerId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Jugador de grupo no encontrado.')

  const group = Array.isArray(data.group) ? data.group[0] : data.group
  const tournament = Array.isArray(group?.tournament) ? group.tournament[0] : group?.tournament
  if (!group || !tournament) throw new Error('No se pudo resolver el grupo del jugador.')
  if (tournament.status !== 'draft') throw new Error('Solo puedes dar de baja jugadores en un torneo borrador.')

  const now = new Date().toISOString()
  const { error: movErr } = await supabase.from('tournament_movements').insert({
    from_tournament_id: tournament.previous_tournament_id ?? tournament.id,
    to_tournament_id: tournament.id,
    player_id: data.user_id,
    from_group_id: group.id,
    to_group_id: null,
    from_position: data.seed_order ?? 0,
    points: 0,
    games_for: 0,
    games_difference: 0,
    movement_type: 'player_removed',
    movement_reason: null,
    raw_movement: JSON.stringify({ displayName: data.display_name, source: 'draft_admin_removal' }),
    removed_by_admin_id: input.adminId,
    removed_at: now,
  })
  if (movErr) throw movErr

  const { error: delErr } = await supabase.from('group_players').delete().eq('id', input.groupPlayerId)
  if (delErr) throw delErr
}

export async function publishDraftTournament(input: {
  tournamentId: string
  adminId: string | null
  groupSize?: number
}): Promise<{ groupsPublished: number; matchesInserted: number }> {
  const groupSize = input.groupSize ?? DEFAULT_GROUP_SIZE
  const groups = sortGroups(await getAdminGroupsForTournament(input.tournamentId))
  if (groups.length === 0) throw new Error('El torneo no tiene grupos para publicar.')
  const tournament = ensureDraftTournament(groups)
  const balance = groups.map((group) => toBalanceRow(group, groupSize))
  const invalid = balance.find((row) => row.status !== 'ok')
  if (invalid) {
    throw new Error(`No se puede publicar: «${invalid.groupName}» tiene ${invalid.playerCount}/${groupSize} jugadores.`)
  }
  const withMatches = groups.find((group) => group.matches.length > 0)
  if (withMatches) {
    throw new Error(`«${withMatches.name}» ya tiene partidos. Regenera o limpia cruces antes de publicar.`)
  }

  let matchesInserted = 0
  for (const group of groups) {
    matchesInserted += await generateRoundRobinMatches({
      tournamentId: tournament.id,
      groupId: group.id,
      players: group.players,
      createdBy: input.adminId,
      mode: 'fill',
    })
  }

  await updateTournament(tournament.id, { status: 'active' })

  return {
    groupsPublished: groups.length,
    matchesInserted,
  }
}
