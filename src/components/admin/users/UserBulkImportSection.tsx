import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  CircleStop,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { AdminSectionTitle } from '@/components/admin/shared/AdminSectionTitle'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  buildBulkImportPreview,
  type BulkImportContext,
  type BulkImportParsedRow,
  type BulkImportPreviewRow,
} from '@/lib/bulkUserImportPreview'
import { isAdminRole } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import {
  downloadBulkCredentialsCsv,
  downloadUserImportTemplate,
  type CredentialExportRow,
} from '@/lib/userImportTemplate'
import {
  fetchBulkImportPoolContext,
  invokeBulkCreateUsers,
  listTournamentsForBulkImport,
  parseUserImportFile,
} from '@/services/bulkUserImport'
import { tournamentStatusLabel } from '@/services/playerViewModel'
import { useAuthStore } from '@/stores/authStore'

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

export function UserBulkImportSection() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  const callerIsSuper = profile?.role === 'super_admin'

  const fileInputRef = useRef<HTMLInputElement>(null)
  const importAbortRef = useRef<AbortController | null>(null)

  const [auditTournamentId, setAuditTournamentId] = useState<string>('')
  const [createMissingCategories, setCreateMissingCategories] = useState(true)
  const [parsedRows, setParsedRows] = useState<BulkImportParsedRow[] | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<Awaited<ReturnType<typeof invokeBulkCreateUsers>> | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const tournamentsQ = useQuery({
    queryKey: ['bulk-import-tournaments'],
    queryFn: listTournamentsForBulkImport,
  })

  const contextQ = useQuery({
    queryKey: ['bulk-import-pool-context', auditTournamentId || 'none'],
    queryFn: () => fetchBulkImportPoolContext(auditTournamentId.trim() || null),
    enabled: isAdminRole(profile?.role),
    staleTime: 30_000,
  })

  const preview = useMemo((): BulkImportPreviewRow[] | null => {
    if (!parsedRows?.length || !contextQ.data) return null
    const ctx = contextQ.data as BulkImportContext
    return buildBulkImportPreview(parsedRows, ctx, {
      createMissingCategories,
      createMissingGroups: true,
      callerIsSuperAdmin: callerIsSuper,
      importTournamentId: auditTournamentId.trim() || null,
    })
  }, [parsedRows, contextQ.data, createMissingCategories, callerIsSuper, auditTournamentId])

  const previewStats = useMemo(() => {
    if (!preview?.length) return null
    return {
      ready: preview.filter((r) => r.state === 'ready').length,
      warning: preview.filter((r) => r.state === 'warning').length,
      error: preview.filter((r) => r.state === 'error').length,
    }
  }, [preview])

  const hasBlockingErrors = preview?.some((r) => r.state === 'error') ?? false
  const canImport = Boolean(preview?.length && !hasBlockingErrors && isAdminRole(profile?.role))
  const hasStagedData = Boolean(fileName || (parsedRows && parsedRows.length > 0))

  const clearStagedFile = useCallback(() => {
    importAbortRef.current?.abort()
    importAbortRef.current = null
    setParsedRows(null)
    setFileName(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const importMut = useMutation({
    mutationFn: async () => {
      if (!preview?.length) throw new Error('Sin datos')
      importAbortRef.current?.abort()
      const ac = new AbortController()
      importAbortRef.current = ac

      const rows = preview
        .filter((r) => r.state !== 'error')
        .map((r) => ({
          rowNumber: r.rowNumber,
          externalId: r.externalId,
          fullName: r.fullName,
          role: r.role,
          categoryName: r.categoryName,
          password: r.password,
          groupName: r.groupName.trim() ? r.groupName : null,
          pj: r.pj,
          pts: r.pts,
        }))
      if (!rows.length) throw new Error('No hay filas válidas para importar')
      const tid = auditTournamentId.trim() || null
      return invokeBulkCreateUsers({
        tournamentId: tid,
        fileName: fileName ?? undefined,
        createMissingCategories,
        rows,
        signal: ac.signal,
      })
    },
    onSuccess: async (data) => {
      importAbortRef.current = null
      setResult(data)
      toast.success(`Importación finalizada: ${data.success} correctos, ${data.errors} errores`)
      await qc.invalidateQueries({ queryKey: ['admin-users'] })
      await qc.invalidateQueries({ queryKey: ['admin-groups'] })
      await qc.invalidateQueries({ queryKey: ['bulk-import-pool-context'] })
      await qc.invalidateQueries({ queryKey: ['player-categories'] })
    },
    onError: (e) => {
      importAbortRef.current = null
      if (isAbortError(e)) {
        toast.message('Importación cancelada')
        return
      }
      toast.error(e instanceof Error ? e.message : 'Error en importación')
    },
  })

  const cancelRunningImport = () => {
    importAbortRef.current?.abort()
  }

  const onPickFile = useCallback(async (f: File | null) => {
    setResult(null)
    if (!f) return
    try {
      const rows = await parseUserImportFile(f)
      setParsedRows(rows)
      setFileName(f.name)
      toast.success(`Archivo leído: ${rows.length} filas`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo leer el archivo')
      setParsedRows(null)
      setFileName(null)
    }
  }, [])

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPickFile(e.target.files?.[0] ?? null)
  }

  const onDropFile = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    const lower = f.name.toLowerCase()
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      toast.error('Usa un archivo .csv, .xlsx o .xls')
      return
    }
    onPickFile(f)
  }

  const downloadCreds = () => {
    if (!result?.results?.length) return
    const ok = result.results.filter((r) => r.status === 'success')
    const rows: CredentialExportRow[] = ok.map((r) => ({
      ID: r.externalId,
      Nombre: r.fullName,
      Email: r.email,
      Contraseña: r.temporaryPassword === '—' ? '(sin cambio)' : r.temporaryPassword,
      Categoría: r.categoryName,
      Acción: r.operation === 'updated' ? 'Actualizado' : 'Creado',
    }))
    downloadBulkCredentialsCsv(rows)
  }

  return (
    <section className="space-y-5" aria-labelledby="bulk-import-heading">
      <AdminSectionTitle
        id="bulk-import-heading"
        title="Carga masiva de usuarios"
        description="Sube CSV o Excel, revisa la vista previa e importa. Puedes cancelar la petición en curso o descartar el archivo y empezar de nuevo."
      />

      <Card
        className={cn(
          'overflow-hidden rounded-2xl border border-slate-200/90 shadow-sm ring-1 ring-slate-900/[0.04]',
          importMut.isPending && 'ring-2 ring-[#1F5A4C]/25',
        )}
      >
        <div className="h-1 w-full bg-gradient-to-r from-[#1F5A4C] via-emerald-600 to-teal-500" aria-hidden />
        <CardHeader className="border-b border-slate-200/80 bg-slate-50/50 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base font-semibold text-slate-900">Importar desde archivo</CardTitle>
              <CardDescription className="max-w-2xl text-slate-600">
                Columnas: ID, Nombre, Rol, Categoría, Contraseña (8 dígitos). Opcionales: Grupo, PJ, Pts. Misma plantilla
                para altas y actualizaciones; grupos inexistentes se crean en el torneo elegido.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => downloadUserImportTemplate()}>
                <Download className="size-4" />
                Plantilla
              </Button>
              <Link
                to="/admin/categories"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'sm',
                  className: 'inline-flex h-8 items-center justify-center gap-2 px-3',
                })}
              >
                Categorías
              </Link>
            </div>
          </div>

          <details className="group mt-3 rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-sm">
            <summary className="cursor-pointer list-none font-medium text-slate-700 outline-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <Info className="size-4 text-[#1F5A4C]" aria-hidden />
                Instrucciones detalladas
                <span className="text-xs font-normal text-slate-500 group-open:hidden">(ampliar)</span>
              </span>
            </summary>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-slate-600">
              <li>Si el ID coincide con <code className="rounded bg-slate-100 px-1">external_id</code> de un usuario, la fila actualiza datos; contraseña vacía no la cambia.</li>
              <li>Con torneo seleccionado y columna Grupo, el sistema valida cupos y puede crear el grupo si no existe.</li>
              <li>Puedes cancelar mientras la barra de progreso está activa; el servidor puede haber procesado parte del lote.</li>
            </ul>
          </details>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-700">Torneo (opcional)</Label>
              <Select
                value={auditTournamentId || '__none__'}
                onValueChange={(v) => {
                  setAuditTournamentId(v === '__none__' ? '' : (v ?? ''))
                  setResult(null)
                }}
              >
                <SelectTrigger className="h-11 border-slate-200 bg-white">
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Ninguno (pool global)</SelectItem>
                  {(tournamentsQ.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {tournamentStatusLabel(t.status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Requerido si el archivo asigna grupos en un torneo concreto.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">Archivo</Label>
              <input
                ref={fileInputRef}
                id="bulk-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={onFileInputChange}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setIsDraggingFile(true)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDraggingFile(true)
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={onDropFile}
                className={cn(
                  'flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 transition-colors',
                  isDraggingFile
                    ? 'border-[#1F5A4C] bg-emerald-50/60'
                    : 'border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <FileSpreadsheet className="size-8 text-slate-400" aria-hidden />
                <div className="text-center text-sm text-slate-600">
                  {fileName ? (
                    <span className="font-medium text-slate-800">{fileName}</span>
                  ) : (
                    <>
                      <span className="font-medium text-slate-800">Arrastra o haz clic</span>
                      <span className="block text-xs text-slate-500">CSV, XLS o XLSX</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 text-[#1F5A4C] focus:ring-[#1F5A4C]"
                checked={createMissingCategories}
                onChange={(e) => setCreateMissingCategories(e.target.checked)}
              />
              Crear categorías de jugador faltantes
            </label>
            {hasStagedData ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-slate-600 hover:text-slate-900"
                onClick={clearStagedFile}
                disabled={importMut.isPending}
              >
                <X className="size-4" />
                Descartar archivo
              </Button>
            ) : null}
          </div>

          {contextQ.isFetching ? (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin text-[#1F5A4C]" />
              Validando categorías, IDs y grupos…
            </p>
          ) : null}

          {preview && preview.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Vista previa</p>
                  <p className="text-xs text-slate-500">{preview.length} filas · corrige errores antes de importar</p>
                </div>
                {previewStats ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-900">
                      Listas {previewStats.ready}
                    </Badge>
                    <Badge variant="secondary" className="border border-amber-200 bg-amber-50 text-amber-950">
                      Avisos {previewStats.warning}
                    </Badge>
                    <Badge variant="destructive" className="font-medium">
                      Errores {previewStats.error}
                    </Badge>
                  </div>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="max-h-[min(28rem,55vh)] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm hover:bg-slate-50/95">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Contraseña</TableHead>
                        <TableHead>Grupo</TableHead>
                        <TableHead>PJ</TableHead>
                        <TableHead>Pts</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((r) => (
                        <TableRow
                          key={r.rowNumber}
                          className={cn(
                            r.state === 'error' && 'bg-red-50/50',
                            r.state === 'warning' && 'bg-amber-50/40',
                          )}
                        >
                          <TableCell className="tabular-nums text-slate-500">{r.rowNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{r.externalId}</TableCell>
                          <TableCell>{r.fullName}</TableCell>
                          <TableCell>{r.role}</TableCell>
                          <TableCell>{r.categoryName}</TableCell>
                          <TableCell className="font-mono text-xs tracking-wide">{r.password || '—'}</TableCell>
                          <TableCell>{r.groupName || '—'}</TableCell>
                          <TableCell className="text-sm tabular-nums">{r.pj ?? '—'}</TableCell>
                          <TableCell className="text-sm tabular-nums">{r.pts ?? '—'}</TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                                r.state === 'ready' && 'bg-emerald-100 text-emerald-800',
                                r.state === 'warning' && 'bg-amber-100 text-amber-900',
                                r.state === 'error' && 'bg-red-100 text-red-800',
                              )}
                            >
                              {r.state === 'ready' ? 'Listo' : r.state === 'warning' ? 'Aviso' : 'Error'}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[14rem] text-xs text-slate-600">{r.messages.join(' · ')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  className="gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90"
                  disabled={!canImport || importMut.isPending}
                  onClick={() => importMut.mutate()}
                >
                  {importMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {importMut.isPending ? 'Importando…' : 'Importar usuarios'}
                </Button>
                {importMut.isPending ? (
                  <Button type="button" variant="outline" className="gap-2 border-red-200 text-red-800 hover:bg-red-50" onClick={cancelRunningImport}>
                    <CircleStop className="size-4" />
                    Cancelar importación
                  </Button>
                ) : null}
                {hasBlockingErrors ? (
                  <span className="flex items-center gap-1.5 text-sm text-red-700">
                    <AlertTriangle className="size-4 shrink-0" />
                    Hay filas con error; no se importarán hasta corregirlas.
                  </span>
                ) : null}
              </div>
            </div>
          ) : parsedRows?.length === 0 ? (
            <p className="text-sm text-slate-600">El archivo no contenía filas de datos.</p>
          ) : null}

          {result ? (
            <div className="space-y-4 rounded-xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/80 to-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <span className="font-semibold text-slate-800">Lote completado</span>
                <Badge variant="outline" className="border-slate-200 font-mono text-[11px] text-slate-600">
                  {result.batchId.slice(0, 8)}…
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-emerald-700">{result.success}</p>
                  <p className="text-xs font-medium text-slate-500">Correctos</p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-red-600">{result.errors}</p>
                  <p className="text-xs font-medium text-slate-500">Errores</p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-slate-800">{result.results?.length ?? 0}</p>
                  <p className="text-xs font-medium text-slate-500">Filas procesadas</p>
                </div>
              </div>
              <p className="text-xs text-amber-900">
                Descarga el CSV de credenciales: contraseñas nuevas aparecen tal como en el archivo; en actualizaciones sin
                contraseña verás “(sin cambio)”.
              </p>
              <Button type="button" variant="outline" className="gap-2 border-slate-200" onClick={downloadCreds}>
                <FileSpreadsheet className="size-4" />
                Descargar credenciales (CSV)
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
