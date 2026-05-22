import Papa from 'papaparse'
import * as XLSX from 'xlsx'

import { formatRecoveryEmailDisplay } from '@/lib/profileEmail'
import { normalizePhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { getTournamentRules } from '@/services/tournaments'
import { listPlayerCategories } from '@/services/playerCategories'
import type { Database, Group, GroupPlayer, MatchRow, Profile, Tournament, TournamentFinalStanding } from '@/types/database'
import { computeGroupRanking, type RankingRow } from '@/utils/ranking'

export const EXPORT_PLAYERS_RANKING_HEADERS = [
  'id',
  'nombre',
  'correo_recuperacion',
  'celular',
  'contraseña',
  'cuenta',
  'rol',
  'torneo',
  'categoria',
  'grupo',
  'ranking',
  'puntos',
  'juegos',
] as const

export type ExportablePlayerRankingRow = Record<(typeof EXPORT_PLAYERS_RANKING_HEADERS)[number], string>

export type ExportPlayersFiltersInput = {
  tournamentId?: string | null
  /** `group_categories.id` — opcional */
  categoryId?: string | null
  /** `groups.id` — opcional; debe pertenecer al torneo */
  groupId?: string | null
}

export type ExportPlayersRankingSummary = {
  tournamentName: string
  tournamentStatus: Tournament['status'] | null
  playerCount: number
  distinctGroupCount: number
  /** Categorías de división (`group_categories`) presentes entre los grupos exportados */
  divisionCategoryCount: number
}

export type ExportPlayersRankingBundle = {
  rows: ExportablePlayerRankingRow[]
  summary: ExportPlayersRankingSummary
}

/** Caracteres no permitidos en nombres de archivo en Windows/macOS/Linux comunes */
export function sanitizeExportFilenameSegment(raw: string, maxLen = 48): string {
  const t = raw.trim().normalize('NFKD')
  const stripped = t.replace(/[^\p{L}\p{N}\s.-]+/gu, '').replace(/\s+/g, '_')
  const base = stripped.replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, maxLen)
  return base || 'torneo'
}

function finalizeKey(groupId: string, userId: string): string {
  return `${groupId}\t${userId}`
}

type ProfileExportBase = Pick<
  ExportablePlayerRankingRow,
  'id' | 'nombre' | 'correo_recuperacion' | 'celular' | 'contraseña' | 'cuenta' | 'rol'
>

type AdminUserCredential = Database['public']['Tables']['admin_user_credentials']['Row']

function profileFieldsForExport(profile: Profile | undefined, visiblePassword: string | undefined): ProfileExportBase {
  const passwordForExport = visiblePassword?.trim() || 'No disponible'
  if (!profile) {
    return {
      id: '',
      nombre: '',
      correo_recuperacion: '',
      celular: '',
      contraseña: passwordForExport,
      cuenta: 'activo',
      rol: '',
    }
  }

  let correoRecovery = ''
  const shown = formatRecoveryEmailDisplay(profile.email)
  if (shown !== 'Sin correo') correoRecovery = profile.email?.trim() ?? ''

  const phoneNorm = normalizePhone(profile.phone ?? '')
  const celular = phoneNorm.ok ? phoneNorm.digits : (profile.phone ?? '').trim()

  const cuenta = profile.status === 'inactive' ? 'inactivo' : 'activo'

  return {
    id: (profile.external_id ?? '').trim(),
    nombre: (profile.full_name ?? '').trim(),
    correo_recuperacion: correoRecovery,
    celular,
    contraseña: passwordForExport,
    cuenta,
    rol: profile.role,
  }
}

/** Datos consolidados para export desde admin: prioriza `tournament_final_standings` si hay filas y cae a ranking en vivo (`computeGroupRanking`). */
export async function getExportablePlayersData(filters: ExportPlayersFiltersInput): Promise<ExportPlayersRankingBundle> {
  const tournamentId = filters.tournamentId?.trim() ?? ''
  if (!tournamentId) {
    return {
      rows: [],
      summary: {
        tournamentName: '',
        tournamentStatus: null,
        playerCount: 0,
        distinctGroupCount: 0,
        divisionCategoryCount: 0,
      },
    }
  }

  const categoryScope = filters.categoryId?.trim() || null
  const groupScope = filters.groupId?.trim() || null

  const [tournamentRes, rules] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).maybeSingle(),
    getTournamentRules(tournamentId),
  ])
  if (tournamentRes.error) throw tournamentRes.error
  const tournament = tournamentRes.data as Tournament | null
  if (!tournament) {
    return {
      rows: [],
      summary: {
        tournamentName: '',
        tournamentStatus: null,
        playerCount: 0,
        distinctGroupCount: 0,
        divisionCategoryCount: 0,
      },
    }
  }
  if (!rules) throw new Error('No se encontraron reglas del torneo.')

  const { data: groupsRaw, error: gErr } = await supabase
    .from('groups')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('order_index', { ascending: true })

  if (gErr) throw gErr

  let groupsFiltered = [...((groupsRaw ?? []) as Group[])].sort((a, b) => {
    const o = (a.order_index ?? 0) - (b.order_index ?? 0)
    if (o !== 0) return o
    return a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' })
  })

  if (categoryScope) {
    groupsFiltered = groupsFiltered.filter((g) => g.group_category_id === categoryScope)
  }
  if (groupScope) {
    groupsFiltered = groupsFiltered.filter((g) => g.id === groupScope)
    if (!groupsFiltered.length) {
      return {
        rows: [],
        summary: {
          tournamentName: tournament.name,
          tournamentStatus: tournament.status,
          playerCount: 0,
          distinctGroupCount: 0,
          divisionCategoryCount: 0,
        },
      }
    }
  }

  const groupIds = groupsFiltered.map((g) => g.id)
  const divisionCats = new Set(groupsFiltered.map((g) => g.group_category_id).filter(Boolean) as string[])

  let allGroupPlayers: GroupPlayer[] = []
  if (groupIds.length) {
    const { data: gps, error: gpErr } = await supabase.from('group_players').select('*').in('group_id', groupIds)
    if (gpErr) throw gpErr
    allGroupPlayers = (gps ?? []) as GroupPlayer[]
  }

  if (!allGroupPlayers.length) {
    return {
      rows: [],
      summary: {
        tournamentName: tournament.name,
        tournamentStatus: tournament.status,
        playerCount: 0,
        distinctGroupCount: groupsFiltered.length,
        divisionCategoryCount: divisionCats.size,
      },
    }
  }

  const userIds = [...new Set(allGroupPlayers.map((p) => p.user_id))]
  const { data: profRows, error: pErr } = await supabase.from('profiles').select('*').in('id', userIds)
  if (pErr) throw pErr
  const profiles = (profRows ?? []) as Profile[]
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  const { data: credentialRows, error: credentialErr } = await supabase
    .from('admin_user_credentials')
    .select('user_id,password_plain')
    .in('user_id', userIds)
  if (credentialErr) throw credentialErr
  const visiblePasswordByUserId = new Map(
    ((credentialRows ?? []) as Pick<AdminUserCredential, 'user_id' | 'password_plain'>[]).map((r) => [
      r.user_id,
      r.password_plain,
    ]),
  )

  const playerCategories = await listPlayerCategories()
  const playerCatNames = new Map(playerCategories.map((c) => [c.id, c.name.trim()]))

  const { data: finRowsRaw, error: finErr } = await supabase
    .from('tournament_final_standings')
    .select('*')
    .eq('tournament_id', tournamentId)
    .in('group_id', groupIds)
  if (finErr) throw finErr
  const finalizeRows = (finRowsRaw ?? []) as TournamentFinalStanding[]
  const finalizedByGroupUser = new Map<string, TournamentFinalStanding>()
  for (const fr of finalizeRows) {
    finalizedByGroupUser.set(finalizeKey(fr.group_id, fr.player_id), fr)
  }

  const { data: matchesRaw, error: mErr } = await supabase.from('matches').select('*').eq('tournament_id', tournamentId)
  if (mErr) throw mErr
  const allMatches = (matchesRaw ?? []) as MatchRow[]

  const liveByGroup = new Map<string, Map<string, RankingRow>>()
  for (const g of groupsFiltered) {
    const mpl = allGroupPlayers.filter((x) => x.group_id === g.id)
    const mm = allMatches.filter((x) => x.group_id === g.id)
    const ranked = computeGroupRanking(mpl, mm, rules)
    liveByGroup.set(g.id, new Map(ranked.map((r) => [r.userId, r])))
  }

  const groupById = new Map(groupsFiltered.map((g) => [g.id, g]))

  const sortedPlayers: GroupPlayer[] = [...allGroupPlayers].sort((a, b) => {
    const ga = groupById.get(a.group_id)
    const gb = groupById.get(b.group_id)
    const ia = ga ? (ga.order_index ?? 0) : 0
    const ib = gb ? (gb.order_index ?? 0) : 0
    if (ia !== ib) return ia - ib
    const na = ga?.name ?? ''
    const nb = gb?.name ?? ''
    const cg = na.localeCompare(nb, 'es', { numeric: true, sensitivity: 'base' })
    if (cg !== 0) return cg
    const ra = rankingSortForGroupPlayer(a, finalizedByGroupUser, liveByGroup)
    const rb = rankingSortForGroupPlayer(b, finalizedByGroupUser, liveByGroup)
    if (ra !== rb) return ra - rb
    const pa = profileById.get(a.user_id)?.full_name?.trim() ?? ''
    const pb = profileById.get(b.user_id)?.full_name?.trim() ?? ''
    return pa.localeCompare(pb, 'es', { numeric: true, sensitivity: 'base' })
  })

  const rows: ExportablePlayerRankingRow[] = []
  for (const gp of sortedPlayers) {
    const grp = groupById.get(gp.group_id)
    if (!grp) continue
    const prof = profileById.get(gp.user_id)
    const base = profileFieldsForExport(prof, visiblePasswordByUserId.get(gp.user_id))
    const pk = finalizeKey(gp.group_id, gp.user_id)
    const finals = finalizedByGroupUser.get(pk)
    const live = liveByGroup.get(gp.group_id)?.get(gp.user_id)

    let ranking = ''
    let puntos = '0'
    let juegos = '0'
    if (finals) {
      ranking = String(finals.position)
      puntos = String(finals.points)
      juegos = String(finals.wins + finals.losses)
    } else if (live) {
      ranking = String(live.position)
      puntos = String(live.points)
      juegos = String(live.played)
    }

    const categoriaJugador = prof?.category_id ? (playerCatNames.get(prof.category_id) ?? '') : ''

    rows.push({
      ...base,
      categoria: categoriaJugador,
      torneo: tournament.name,
      grupo: grp.name,
      ranking,
      puntos,
      juegos,
    })
  }

  return {
    rows,
    summary: {
      tournamentName: tournament.name,
      tournamentStatus: tournament.status,
      playerCount: rows.length,
      distinctGroupCount: new Set(groupsFiltered.map((g) => g.id)).size,
      divisionCategoryCount: divisionCats.size,
    },
  }
}

function rankingSortForGroupPlayer(
  gp: GroupPlayer,
  finalizedByGroupUser: Map<string, TournamentFinalStanding>,
  liveByGroup: Map<string, Map<string, RankingRow>>,
): number {
  const pk = finalizeKey(gp.group_id, gp.user_id)
  const fins = finalizedByGroupUser.get(pk)
  if (fins) return fins.position
  const live = liveByGroup.get(gp.group_id)?.get(gp.user_id)
  if (live) return live.position
  return 9999
}

function rowToValues(r: ExportablePlayerRankingRow): string[] {
  return EXPORT_PLAYERS_RANKING_HEADERS.map((k) => r[k])
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function applyExportSheet(ws: XLSX.WorkSheet): void {
  const ref = ws['!ref']
  if (!ref) return
  const range = XLSX.utils.decode_range(ref)
  const lastCol = range.e.c
  const lastRow = range.e.r
  const colLetter = XLSX.utils.encode_col(lastCol)
  ws['!autofilter'] = { ref: `A1:${colLetter}${lastRow + 1}` }

  const widths: { wch: number }[] = []
  for (let c = 0; c <= lastCol; c++) {
    let max = String(EXPORT_PLAYERS_RANKING_HEADERS[c] ?? '').length
    for (let rr = 0; rr <= lastRow; rr++) {
      const addr = XLSX.utils.encode_cell({ r: rr, c })
      const cell = ws[addr]
      const v = cell?.v != null ? String(cell.v) : ''
      max = Math.max(max, Math.min(48, v.length))
    }
    widths.push({ wch: max + 2 })
  }
  ws['!cols'] = widths

  ws['!views'] = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', pane: 'bottomLeft' }]
}

function workbookFromRankingRows(rows: ExportablePlayerRankingRow[]): XLSX.WorkBook {
  const hdr = EXPORT_PLAYERS_RANKING_HEADERS.slice() as unknown as string[]
  const aoa = [hdr, ...rows.map(rowToValues)]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  applyExportSheet(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ranking')
  return wb
}

export function downloadPlayersRankingExcel(rows: ExportablePlayerRankingRow[], tournamentSlug: string): void {
  const wb = workbookFromRankingRows(rows)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const safe = sanitizeExportFilenameSegment(tournamentSlug)
  const fecha = new Date().toISOString().slice(0, 10)
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `export_jugadores_ranking_${safe}_${fecha}.xlsx`,
  )
}

export function downloadPlayersRankingCsv(rows: ExportablePlayerRankingRow[], tournamentSlug: string): void {
  const csv = Papa.unparse(
    { fields: [...EXPORT_PLAYERS_RANKING_HEADERS], data: rows.map(rowToValues) },
    { quotes: true, delimiter: ',', header: true, newline: '\r\n' },
  )
  const bom = '\uFEFF'
  const safe = sanitizeExportFilenameSegment(tournamentSlug)
  const fecha = new Date().toISOString().slice(0, 10)
  triggerDownload(new Blob([bom + csv], { type: 'text/csv;charset=utf-8' }), `export_jugadores_ranking_${safe}_${fecha}.csv`)
}

export async function listExportGroupOptions(tournamentId: string): Promise<Pick<Group, 'id' | 'name' | 'group_category_id' | 'order_index'>[]> {
  const tid = tournamentId.trim()
  if (!tid) return []
  const { data, error } = await supabase
    .from('groups')
    .select('id,name,group_category_id,order_index')
    .eq('tournament_id', tid)
    .order('order_index', { ascending: true })
  if (error) throw error
  return [...((data ?? []) as Pick<Group, 'id' | 'name' | 'group_category_id' | 'order_index'>[])].sort((a, b) => {
    const o = (a.order_index ?? 0) - (b.order_index ?? 0)
    if (o !== 0) return o
    return a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' })
  })
}
