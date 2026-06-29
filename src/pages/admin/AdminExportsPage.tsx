import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronDown, Database, Download, FileSpreadsheet, Info, Layers, Trophy, Users } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { matchesInTournamentGroupScope } from '@/components/admin/shared/adminMatchFilters'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  downloadPlayersRankingCsv,
  downloadPlayersRankingExcel,
  getExportablePlayersData,
  listExportGroupOptions,
  type ExportablePlayerRankingRow,
} from '@/services/exportPlayersRanking'
import { listGroupCategories } from '@/services/groupCategories'
import { listTournamentOptionsForDashboard } from '@/services/dashboard/tournamentDashboardService'
import { getAdminMatches } from '@/services/admin'
import { getTournamentRules } from '@/services/tournaments'
import { tournamentStatusLabel } from '@/services/playerViewModel'
import { downloadMatchResultsMatrixExcel, matchToImportCompatibleRow } from '@/lib/matchResultsExport'
import { cn } from '@/lib/utils'

const CAT_ALL = '__all__'
const GRP_ALL = '__all__'

const EXPORT_FILTERS_INFO =
  'Elige torneo (obligatorio). Categoría y grupo son opcionales; el ranking usa snapshot oficial del cierre si existe, o el cálculo en vivo del torneo.'

const PREVIEW_PAGE_SIZE = 25

const RANKING_PREVIEW_COLUMNS = ['id', 'nombre', 'grupo', 'ranking', 'puntos', 'juegos'] as const

type RankingSortKey = 'id' | 'nombre' | 'grupo'

const RANKING_COLUMN_LABELS: Record<(typeof RANKING_PREVIEW_COLUMNS)[number], string> = {
  id: 'ID',
  nombre: 'Nombre',
  grupo: 'Grupo',
  ranking: 'Ranking',
  puntos: 'Puntos',
  juegos: 'Juegos',
}

function rankingSortValue(row: ExportablePlayerRankingRow, key: RankingSortKey): string {
  return row[key] ?? ''
}

function ExportCollapsiblePreviewShell({
  id,
  title,
  summary,
  expanded,
  onToggle,
  toolbar,
  children,
  footer,
}: {
  id: string
  title: string
  summary: string
  expanded: boolean
  onToggle: () => void
  toolbar?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section
      id={id}
      data-name="export-preview-panel"
      data-expanded={expanded ? 'true' : 'false'}
      className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
    >
      <button
        id={`${id}-toggle`}
        type="button"
        aria-expanded={expanded}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className={cn(
          'flex w-full items-start gap-3 px-3 py-3 text-left outline-none transition-colors sm:items-center sm:px-4 sm:py-3.5',
          'hover:bg-slate-50/90 focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/25 focus-visible:ring-inset',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{summary}</span>
        </span>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#1F5A4C]/30 bg-[#1F5A4C]/5 text-[#1F5A4C]"
          aria-hidden
        >
          <ChevronDown className={cn('size-4 transition-transform duration-200', expanded && 'rotate-180')} />
        </span>
      </button>

      {expanded ? (
        <div id={`${id}-panel`} className="border-t border-slate-100">
          {toolbar ? (
            <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
              {toolbar}
            </div>
          ) : null}
          {children}
          {footer ? <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-2.5 sm:px-4">{footer}</div> : null}
        </div>
      ) : null}
    </section>
  )
}

function ExportPreviewLoadMore({
  visibleCount,
  totalCount,
  onLoadMore,
}: {
  visibleCount: number
  totalCount: number
  onLoadMore: () => void
}) {
  if (visibleCount >= totalCount) return null
  const remaining = totalCount - visibleCount
  return (
    <button
      type="button"
      onClick={onLoadMore}
      className="mx-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 shadow-sm hover:bg-slate-50"
    >
      <ChevronDown className="size-4" aria-hidden />
      Ver {Math.min(PREVIEW_PAGE_SIZE, remaining).toLocaleString('es-MX')} más
      <span className="text-xs text-slate-400">({remaining.toLocaleString('es-MX')} restantes)</span>
    </button>
  )
}

function ExportRankingPreview({
  rows,
  resetKey,
}: {
  rows: ExportablePlayerRankingRow[]
  resetKey: string
}) {
  const [expanded, setExpanded] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PREVIEW_PAGE_SIZE)
  const [sort, setSort] = useState<{ key: RankingSortKey; direction: 'asc' | 'desc' }>({
    key: 'nombre',
    direction: 'asc',
  })

  useEffect(() => {
    queueMicrotask(() => {
      setExpanded(true)
      setVisibleCount(PREVIEW_PAGE_SIZE)
      setSort({ key: 'nombre', direction: 'asc' })
    })
  }, [resetKey])

  const sortedRows = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => {
      const av = rankingSortValue(a, sort.key)
      const bv = rankingSortValue(b, sort.key)
      const cmp = av.localeCompare(bv, 'es', { numeric: true, sensitivity: 'base' })
      return sort.direction === 'asc' ? cmp : -cmp
    })
    return list
  }, [rows, sort])

  const visibleRows = sortedRows.slice(0, visibleCount)

  const sortToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-600">Ordenar por</span>
      {(['id', 'nombre', 'grupo'] as const).map((key) => {
        const active = sort.key === key
        return (
          <Button
            key={key}
            id={`admin-export-ranking-sort-${key}`}
            type="button"
            size="sm"
            variant={active ? 'default' : 'outline'}
            className={cn('h-8 text-xs', active && 'bg-[#1F5A4C] hover:bg-[#1F5A4C]/90')}
            onClick={() =>
              setSort((prev) =>
                prev.key === key
                  ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                  : { key, direction: 'asc' },
              )
            }
          >
            {key === 'id' ? 'ID' : key === 'nombre' ? 'Nombre' : 'Grupo'}
            {active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : null}
          </Button>
        )
      })}
    </div>
  )

  return (
    <ExportCollapsiblePreviewShell
      id="admin-export-ranking-preview"
      title="Jugadores"
      summary={`${rows.length.toLocaleString('es-MX')} jugador(es) · mostrando ${Math.min(visibleCount, rows.length).toLocaleString('es-MX')} de ${rows.length.toLocaleString('es-MX')}`}
      expanded={expanded}
      onToggle={() => setExpanded((open) => !open)}
      toolbar={sortToolbar}
      footer={
        <ExportPreviewLoadMore
          visibleCount={visibleCount}
          totalCount={sortedRows.length}
          onLoadMore={() => setVisibleCount((n) => n + PREVIEW_PAGE_SIZE)}
        />
      }
    >
      <div className="max-h-[min(28rem,60vh)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
            <TableRow className="hover:bg-slate-50/95">
              {RANKING_PREVIEW_COLUMNS.map((c) => (
                <TableHead
                  key={c}
                  className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4"
                >
                  {RANKING_COLUMN_LABELS[c]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, rowIndex) => (
              <TableRow
                key={`${row.id}-${row.grupo}-${rowIndex}`}
                className={cn('text-xs', rowIndex % 2 === 1 && 'bg-slate-50/40')}
              >
                {RANKING_PREVIEW_COLUMNS.map((c) => (
                  <TableCell
                    key={c}
                    className={cn(
                      'px-3 py-2 sm:px-4',
                      c === 'id' && 'font-mono tabular-nums text-slate-600',
                      c === 'nombre' && 'min-w-[8rem] max-w-[14rem] font-medium text-slate-900',
                      c === 'grupo' && 'max-w-[10rem] truncate text-slate-700',
                      (c === 'ranking' || c === 'puntos' || c === 'juegos') && 'tabular-nums text-slate-800',
                    )}
                    title={c === 'nombre' || c === 'grupo' ? row[c] : undefined}
                  >
                    {row[c] || '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ExportCollapsiblePreviewShell>
  )
}

type MatchPreviewRow = ReturnType<typeof matchToImportCompatibleRow>

function formatMatchPreviewScore(row: MatchPreviewRow): string {
  const sets: string[] = []
  if (row.set_1_a || row.set_1_b) sets.push(`${row.set_1_a || '0'}-${row.set_1_b || '0'}`)
  if (row.set_2_a || row.set_2_b) sets.push(`${row.set_2_a || '0'}-${row.set_2_b || '0'}`)
  if (row.set_3_a || row.set_3_b) sets.push(`${row.set_3_a || '0'}-${row.set_3_b || '0'}`)
  return sets.length ? sets.join(' · ') : '—'
}

function ExportMatchResultsPreview({
  rows,
  resetKey,
}: {
  rows: MatchPreviewRow[]
  resetKey: string
}) {
  const [expanded, setExpanded] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PREVIEW_PAGE_SIZE)

  useEffect(() => {
    queueMicrotask(() => {
      setExpanded(true)
      setVisibleCount(PREVIEW_PAGE_SIZE)
    })
  }, [resetKey])

  const visibleRows = rows.slice(0, visibleCount)

  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500">
        No hay partidos para los filtros seleccionados.
      </p>
    )
  }

  return (
    <ExportCollapsiblePreviewShell
      id="admin-export-matches-preview"
      title="Partidos y resultados"
      summary={`${rows.length.toLocaleString('es-MX')} partido(s) · mostrando ${Math.min(visibleCount, rows.length).toLocaleString('es-MX')} de ${rows.length.toLocaleString('es-MX')}`}
      expanded={expanded}
      onToggle={() => setExpanded((open) => !open)}
      footer={
        <ExportPreviewLoadMore
          visibleCount={visibleCount}
          totalCount={rows.length}
          onLoadMore={() => setVisibleCount((n) => n + PREVIEW_PAGE_SIZE)}
        />
      }
    >
      <div className="max-h-[min(28rem,60vh)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
            <TableRow className="hover:bg-slate-50/95">
              <TableHead className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4">
                Grupo
              </TableHead>
              <TableHead className="min-w-[10rem] whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4">
                Partido
              </TableHead>
              <TableHead className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4">
                IDs
              </TableHead>
              <TableHead className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4">
                Marcador
              </TableHead>
              <TableHead className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4">
                Ganador
              </TableHead>
              <TableHead className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4">
                Tipo
              </TableHead>
              <TableHead className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4">
                Estado
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, rowIndex) => (
              <TableRow
                key={`${row.group_name}-${row.player_a_id}-${row.player_b_id}-${rowIndex}`}
                className={cn('text-xs', rowIndex % 2 === 1 && 'bg-slate-50/40')}
              >
                <TableCell className="max-w-[9rem] truncate px-3 py-2 font-medium text-slate-700 sm:px-4" title={row.group_name}>
                  {row.group_name || '—'}
                </TableCell>
                <TableCell className="min-w-[10rem] max-w-[14rem] px-3 py-2 sm:px-4">
                  <p className="truncate font-medium text-slate-900" title={`${row.player_a_name} vs ${row.player_b_name}`}>
                    {row.player_a_name} <span className="font-normal text-slate-400">vs</span> {row.player_b_name}
                  </p>
                </TableCell>
                <TableCell className="px-3 py-2 font-mono text-[11px] leading-snug text-slate-600 sm:px-4">
                  <span className="block truncate" title={row.player_a_id}>
                    A: {row.player_a_id || '—'}
                  </span>
                  <span className="block truncate" title={row.player_b_id}>
                    B: {row.player_b_id || '—'}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-slate-900 sm:px-4">
                  {formatMatchPreviewScore(row)}
                </TableCell>
                <TableCell className="max-w-[8rem] truncate px-3 py-2 font-mono text-[11px] text-slate-700 sm:px-4" title={row.winner_id}>
                  {row.winner_id || '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 text-slate-700 sm:px-4">{row.result_type || '—'}</TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 sm:px-4">
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                    {row.status || '—'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ExportCollapsiblePreviewShell>
  )
}

export function AdminExportsPage() {
  const [explicitTournamentId, setExplicitTournamentId] = useState<string | null>(null)
  const [divisionId, setDivisionId] = useState(CAT_ALL)
  const [groupId, setGroupId] = useState(GRP_ALL)

  const tournamentsQ = useQuery({
    queryKey: ['export-tournament-options'],
    queryFn: listTournamentOptionsForDashboard,
  })

  const defaultTournamentId = useMemo(() => {
    const list = tournamentsQ.data ?? []
    if (!list.length) return ''
    const active = list.find((t) => t.status === 'active')
    return active?.id ?? list[0]!.id
  }, [tournamentsQ.data])

  const tournamentId = explicitTournamentId ?? defaultTournamentId

  const groupCategoriesQ = useQuery({
    queryKey: ['export-group-categories', tournamentId],
    queryFn: () => listGroupCategories(tournamentId),
    enabled: Boolean(tournamentId.trim()),
  })

  const exportGroupsQ = useQuery({
    queryKey: ['export-group-options', tournamentId],
    queryFn: () => listExportGroupOptions(tournamentId),
    enabled: Boolean(tournamentId.trim()),
  })

  const matchesQ = useQuery({
    queryKey: ['admin-matches'],
    queryFn: () => getAdminMatches(),
    staleTime: 30_000,
  })

  const tournamentRulesQ = useQuery({
    queryKey: ['admin-export-tournament-rules', tournamentId],
    queryFn: () => getTournamentRules(tournamentId),
    enabled: Boolean(tournamentId.trim()),
    staleTime: 60_000,
  })

  const filteredGroupOptions = useMemo(() => {
    const rows = exportGroupsQ.data ?? []
    if (divisionId === CAT_ALL) return rows
    return rows.filter((g) => g.group_category_id === divisionId)
  }, [exportGroupsQ.data, divisionId])

  const exportPayload = useMemo(
    () => ({
      tournamentId: tournamentId.trim() || undefined,
      categoryId: divisionId === CAT_ALL ? null : divisionId,
      groupId: groupId === GRP_ALL ? null : groupId,
    }),
    [tournamentId, divisionId, groupId],
  )

  const matchesGroupScope = useMemo(() => {
    if (groupId !== GRP_ALL) return groupId
    if (divisionId === CAT_ALL) return 'all'
    const ids = filteredGroupOptions.map((g) => g.id).filter(Boolean)
    return ids.length ? ids.join('|') : '__none__'
  }, [divisionId, filteredGroupOptions, groupId])

  const matchResultsRows = useMemo(() => {
    if (!tournamentId.trim() || matchesGroupScope === '__none__') return []
    return matchesInTournamentGroupScope(matchesQ.data ?? [], tournamentId, matchesGroupScope)
  }, [matchesQ.data, matchesGroupScope, tournamentId])
  const matchResultsPreviewRows = useMemo(
    () => matchResultsRows.map(matchToImportCompatibleRow),
    [matchResultsRows],
  )

  const exportQ = useQuery({
    queryKey: ['admin-export-players-ranking', exportPayload],
    queryFn: () => getExportablePlayersData(exportPayload),
    enabled: Boolean(exportPayload.tournamentId),
    staleTime: 30_000,
  })

  const slugForFiles = exportQ.data?.summary.tournamentName ?? 'torneo'

  const tournamentLabel = useMemo(() => {
    const t = tournamentsQ.data?.find((x) => x.id === tournamentId)
    if (!t) return null
    return `${t.name} · ${tournamentStatusLabel(t.status)}`
  }, [tournamentId, tournamentsQ.data])

  const exportMut = useMutation({
    mutationFn: async (fmt: 'xlsx' | 'csv') => {
      const data = exportQ.data
      if (!data?.rows.length) throw new Error('Sin filas para exportar')
      if (fmt === 'xlsx') downloadPlayersRankingExcel(data.rows, slugForFiles)
      else downloadPlayersRankingCsv(data.rows, slugForFiles)
    },
    onSuccess: (_void, fmt) =>
      toast.success(fmt === 'xlsx' ? 'Excel descargado' : 'CSV descargado'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo exportar'),
  })

  const matchResultsExportMut = useMutation({
    mutationFn: async () => {
      if (!matchResultsRows.length) throw new Error('Sin partidos para exportar con estos filtros')
      const rules = tournamentRulesQ.data
      if (!rules) throw new Error('No se encontraron reglas del torneo para calcular PG/PP/PTS/POS.')
      const groupLabel =
        groupId !== GRP_ALL
          ? filteredGroupOptions.find((g) => g.id === groupId)?.name
          : divisionId !== CAT_ALL
            ? groupCategoriesQ.data?.find((c) => c.id === divisionId)?.name
            : null
      downloadMatchResultsMatrixExcel(matchResultsRows, rules, [slugForFiles, groupLabel, 'matriz-partidos'].filter(Boolean).join(' '))
    },
    onSuccess: () => toast.success(`${matchResultsRows.length} partido(s) exportado(s) en matriz por grupo.`),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo exportar partidos/resultados'),
  })

  const allPreviewRows = exportQ.data?.rows ?? []
  const totalReady = allPreviewRows.length
  const previewResetKey = `${tournamentId}:${divisionId}:${groupId}:${totalReady}:${matchResultsRows.length}`
  const isBusy = tournamentsQ.isLoading || (Boolean(tournamentId) && exportQ.isFetching)

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Administración"
        title="Exportaciones"
        description="Descarga información de jugadores, credenciales, grupos y ranking por torneo."
      />

      <Card className="overflow-hidden border-slate-200/90 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <div className="flex items-start gap-2 sm:items-center sm:gap-3">
            <CardTitle className="min-w-0 flex-1 text-base text-slate-900 sm:text-lg">
              1. Filtros de exportación
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger
                id="admin-export-filters-info"
                type="button"
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-[#1F5A4C] shadow-sm outline-none',
                  'hover:border-[#1F5A4C]/30 hover:bg-[#1F5A4C]/5 focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/35 sm:size-9',
                )}
                title={EXPORT_FILTERS_INFO}
                aria-label="Información sobre filtros de exportación"
              >
                <Info className="size-4 shrink-0" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={8}
                className="w-[min(calc(100vw-2rem),20rem)] p-3 text-xs leading-relaxed text-slate-600 sm:text-sm"
              >
                <p className="font-semibold text-slate-900">Filtros de exportación</p>
                <p className="mt-1.5">{EXPORT_FILTERS_INFO}</p>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:pt-6">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Torneo</p>
            <Select
              value={tournamentId || undefined}
              onValueChange={(v) => {
                setExplicitTournamentId(v)
                setDivisionId(CAT_ALL)
                setGroupId(GRP_ALL)
              }}
              disabled={!tournamentsQ.data?.length}
            >
              <SelectTrigger id="admin-export-filter-tournament" className="h-11 w-full">
                <SelectValue placeholder="Selecciona torneo…">{tournamentLabel ?? undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(tournamentsQ.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id} label={`${t.name} · ${tournamentStatusLabel(t.status)}`}>
                    {t.name} · {tournamentStatusLabel(t.status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!tournamentId.trim() ? (
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-800">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                Selecciona un torneo para preparar la exportación.
              </p>
            ) : null}
          </div>

          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría (división)</p>
            <Select
              value={divisionId}
              onValueChange={(v) => {
                setDivisionId(v ?? CAT_ALL)
                setGroupId(GRP_ALL)
              }}
              disabled={!tournamentId.trim() || groupCategoriesQ.isLoading}
            >
              <SelectTrigger id="admin-export-filter-category" className="h-11 w-full">
                <SelectValue placeholder="Todos">{divisionId === CAT_ALL ? 'Todos' : undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CAT_ALL} label="Todos">
                  Todos
                </SelectItem>
                {(groupCategoriesQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id} label={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grupo</p>
            <Select
              value={groupId}
              onValueChange={(v) => setGroupId(v ?? GRP_ALL)}
              disabled={!tournamentId.trim() || exportGroupsQ.isLoading}
            >
              <SelectTrigger id="admin-export-filter-group" className="h-11 w-full">
                <SelectValue placeholder="Todos">{groupId === GRP_ALL ? 'Todos' : undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GRP_ALL} label="Todos">
                  Todos
                </SelectItem>
                {filteredGroupOptions.map((g) => (
                  <SelectItem key={g.id} value={g.id} label={g.name}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-900">2. Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          {isBusy && !exportQ.data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-emerald-50/40 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Users className="size-4 text-emerald-700" />
                  Jugadores
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                  {totalReady}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Layers className="size-4 text-slate-700" />
                  Grupos
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                  {exportQ.data?.summary.distinctGroupCount ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Database className="size-4 text-slate-700" />
                  Cat. división
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                  {exportQ.data?.summary.divisionCategoryCount ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-sky-50/40 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Trophy className="size-4 text-sky-800" />
                  Torneo
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                  {exportQ.data?.summary.tournamentName || '—'}
                </p>
                {exportQ.data?.summary.tournamentStatus ? (
                  <Badge variant="secondary" className="mt-2 text-[10px]">
                    {tournamentStatusLabel(exportQ.data.summary.tournamentStatus)}
                  </Badge>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-900">3. Vista previa</CardTitle>
          <CardDescription>
            Revisa los datos antes de exportar. Cada pestaña muestra {PREVIEW_PAGE_SIZE} filas por defecto; usa «Ver más»
            para el resto. En jugadores puedes ordenar por ID, nombre o grupo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {exportQ.error ? (
            <p className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50/70 px-3 py-2 text-sm text-red-900">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {exportQ.error instanceof Error ? exportQ.error.message : 'Error al cargar datos'}
            </p>
          ) : null}

          {!tournamentId.trim() ? (
            <p className="text-sm text-muted-foreground">Selecciona un torneo para preparar la exportación.</p>
          ) : (
            <Tabs defaultValue="players" className="w-full">
              <TabsList
                variant="line"
                className="mb-0 flex h-auto min-h-10 w-full flex-wrap justify-start gap-0 rounded-none border-b border-slate-200 bg-transparent p-0"
              >
                <TabsTrigger
                  value="players"
                  className="rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm data-active:border-[#1F5A4C] data-active:text-[#1F5A4C]"
                >
                  <Users className="size-4 shrink-0 opacity-70" aria-hidden />
                  Jugadores
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] tabular-nums">
                    {totalReady}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="matches"
                  className="rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm data-active:border-[#1F5A4C] data-active:text-[#1F5A4C]"
                >
                  <Trophy className="size-4 shrink-0 opacity-70" aria-hidden />
                  Partidos y resultados
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] tabular-nums">
                    {matchesQ.isLoading ? '…' : matchResultsRows.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="players" className="mt-4 space-y-4 outline-none">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Jugadores</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{totalReady}</p>
                    <p className="mt-1 text-xs text-slate-600">listos para Excel/CSV</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identificadores</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">external_id primero</p>
                    <p className="mt-1 text-xs text-slate-600">si falta, se usa el UUID interno del jugador en grupo</p>
                  </div>
                </div>

                {exportQ.data && totalReady === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500">
                    No hay jugadores para los filtros seleccionados.
                  </p>
                ) : allPreviewRows.length > 0 ? (
                  <ExportRankingPreview rows={allPreviewRows} resetKey={previewResetKey} />
                ) : exportQ.isFetching ? (
                  <Skeleton className="h-72 rounded-xl" />
                ) : null}
              </TabsContent>

              <TabsContent value="matches" className="mt-4 space-y-4 outline-none">
                <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Partidos/resultados</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
                    {matchesQ.isLoading ? '…' : matchResultsRows.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">cruces para matriz por grupo</p>
                </div>

                {matchesQ.isLoading ? (
                  <Skeleton className="h-72 rounded-xl" />
                ) : (
                  <ExportMatchResultsPreview rows={matchResultsPreviewRows} resetKey={previewResetKey} />
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-900">4. Exportar</CardTitle>
          <CardDescription>
            Exporta rankings o descarga la matriz de partidos por grupo con liga, grupo, resultados y posiciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">Jugadores</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Descarga jugadores con ranking, puntos y credenciales según los filtros seleccionados.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                className={cn('gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90')}
                disabled={!totalReady || exportMut.isPending}
                onClick={() => exportMut.mutate('xlsx')}
              >
                <FileSpreadsheet className="size-4" />
                Exportar Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!totalReady || exportMut.isPending}
                onClick={() => exportMut.mutate('csv')}
              >
                <Download className="size-4" />
                Exportar CSV
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3">
            <p className="text-sm font-semibold text-slate-900">Partidos y resultados</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Excel visual tipo matriz: liga, torneo, grupo, jugadores, resultados cruzados, PG, PP, PTS y POS.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-emerald-300 bg-white text-emerald-950 hover:bg-emerald-50"
                disabled={
                  matchesQ.isLoading ||
                  tournamentRulesQ.isLoading ||
                  matchResultsExportMut.isPending ||
                  !matchResultsRows.length
                }
                onClick={() => matchResultsExportMut.mutate()}
              >
                <Download className="size-4" />
                Exportar matriz Excel
              </Button>
              <span className="text-xs font-medium tabular-nums text-emerald-900">
                {matchesQ.isLoading ? 'Cargando...' : `${matchResultsRows.length} partido(s)`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-dashed border-slate-200 bg-slate-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Historial de exportaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs leading-relaxed text-slate-500">
            Pendiente de producto: registro temporal de exports en esta sesión. Por ahora las descargas son locales y
            no se guardan en servidor.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
