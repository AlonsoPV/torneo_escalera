import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertCircle, Database, Download, FileSpreadsheet, Layers, Trophy, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { downloadUsersImportTemplate } from '@/services/adminUsersExport'
import {
  downloadPlayersRankingCsv,
  downloadPlayersRankingExcel,
  getExportablePlayersData,
  listExportGroupOptions,
} from '@/services/exportPlayersRanking'
import { listGroupCategories } from '@/services/groupCategories'
import { listTournamentOptionsForDashboard } from '@/services/dashboard/tournamentDashboardService'
import { tournamentStatusLabel } from '@/services/playerViewModel'
import { cn } from '@/lib/utils'

const CAT_ALL = '__all__'
const GRP_ALL = '__all__'

const PREVIEW_COLUMNS = [
  'id',
  'nombre',
  'torneo',
  'categoria',
  'grupo',
  'contraseña',
  'ranking',
  'puntos',
  'juegos',
] as const

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

  const previewRows = (exportQ.data?.rows ?? []).slice(0, 20)
  const totalReady = exportQ.data?.rows.length ?? 0
  const isBusy = tournamentsQ.isLoading || (Boolean(tournamentId) && exportQ.isFetching)

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Administración"
        title="Exportaciones"
        description="Descarga información de jugadores, credenciales, grupos y ranking por torneo."
      />

      <Card className="overflow-hidden border-slate-200/90 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-base text-slate-900">1. Filtros de exportación</CardTitle>
          <CardDescription>
            Elige torneo (obligatorio). Categoría y grupo son opcionales; el ranking usa snapshot oficial del cierre
            si existe, o el cálculo en vivo del torneo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
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
              <SelectTrigger className="h-11">
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
              <p className="flex items-center gap-1.5 text-xs text-amber-800">
                <AlertCircle className="size-3.5 shrink-0" />
                Selecciona un torneo para preparar la exportación.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría (división)</p>
            <Select
              value={divisionId}
              onValueChange={(v) => {
                setDivisionId(v ?? CAT_ALL)
                setGroupId(GRP_ALL)
              }}
              disabled={!tournamentId.trim() || groupCategoriesQ.isLoading}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CAT_ALL}>Todas las categorías</SelectItem>
                {(groupCategoriesQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grupo</p>
            <Select
              value={groupId}
              onValueChange={(v) => setGroupId(v ?? GRP_ALL)}
              disabled={!tournamentId.trim() || exportGroupsQ.isLoading}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GRP_ALL}>Todos los grupos</SelectItem>
                {filteredGroupOptions.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
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
            Columnas compactas · máximo 20 filas. El archivo completo usa todas las columnas requeridas.
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
          ) : exportQ.data && totalReady === 0 ? (
            <p className="text-sm text-muted-foreground">No hay jugadores para los filtros seleccionados.</p>
          ) : null}

          {previewRows.length > 0 ? (
            <>
              <p className="text-sm font-medium text-slate-800">
                {totalReady.toLocaleString('es-MX')} jugador(es) listo(s) para exportar
              </p>
              <div className="rounded-xl border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/90">
                      {PREVIEW_COLUMNS.map((c) => (
                        <TableHead key={c} className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                          {c.replace(/_/g, ' ')}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((r, i) => (
                      <TableRow key={`${r.id}-${r.grupo}-${i}`} className="text-xs">
                        {PREVIEW_COLUMNS.map((c) => (
                          <TableCell key={c} className="max-w-[10rem] truncate">
                            {r[c]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-900">4. Exportar</CardTitle>
          <CardDescription>
            Nombre del archivo incluye torneo sanitizado y la fecha ISO (consulta ayuda inferior).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
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
          <Button type="button" variant="secondary" className="gap-2" onClick={() => downloadUsersImportTemplate()}>
            <Download className="size-4" />
            Plantilla usuarios (Excel)
          </Button>
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
