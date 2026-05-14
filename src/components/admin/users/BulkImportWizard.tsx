import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleStop,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import {
  BULK_IMPORT_COLUMN_GUIDE,
  buildBulkImportPreviewSummary,
  filterPreviewRows,
  type PreviewFilter,
} from '@/lib/bulkImportWizardUtils'
import { isAdminRole, userRoleLabelEs } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import {
  downloadBulkCredentialsCsv,
  downloadUserImportTemplate,
  type CredentialExportRow,
} from '@/lib/userImportTemplate'
import {
  fetchBulkImportPoolContext,
  invokeBulkCreateUsersChunked,
  listTournamentsForBulkImport,
  parseUserImportFile,
  type BulkImportMergedResponse,
  type BulkImportInvokeRow,
} from '@/services/bulkUserImport'
import { tournamentStatusLabel } from '@/services/playerViewModel'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types/database'

const WIZARD_STEPS = [
  { id: 1, label: 'Archivo', short: '1' },
  { id: 2, label: 'Validación', short: '2' },
  { id: 3, label: 'Confirmación', short: '3' },
  { id: 4, label: 'Importación', short: '4' },
  { id: 5, label: 'Resultado', short: '5' },
] as const

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function downloadImportReportCsv(result: BulkImportMergedResponse, fileLabel: string) {
  const headers = ['Fila', 'ID', 'Celular', 'Nombre', 'Estado', 'Mensaje', 'Operación']
  const lines = [
    headers.join(','),
    ...result.results.map((r) => {
      const cells = [
        String(r.rowNumber),
        r.externalId,
        r.phone ?? '',
        r.fullName,
        r.status === 'success' ? 'OK' : 'Error',
        r.error ?? '',
        r.operation === 'updated' ? 'Actualizado' : r.operation === 'created' ? 'Creado' : '',
      ]
      return cells.map((c) => (/[,"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')
    }),
  ]
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safe = fileLabel.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'import'
  a.download = `informe-importacion-${safe}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function WizardStepper({
  currentStep,
  maxReachable,
}: {
  currentStep: number
  maxReachable: number
}) {
  const pct = Math.min(100, Math.max(0, ((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-center gap-0.5 sm:justify-between sm:gap-1">
        {WIZARD_STEPS.map((s, i) => {
          const done = currentStep > s.id
          const active = currentStep === s.id
          const locked = s.id > maxReachable && !done
          return (
            <Fragment key={s.id}>
              <div
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-1 sm:max-w-[6.5rem]',
                  locked && 'opacity-45',
                )}
              >
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    done && 'bg-emerald-600 text-white',
                    active && !done && 'bg-[#1F5A4C] text-white ring-2 ring-[#1F5A4C]/25',
                    !active && !done && 'bg-slate-200 text-slate-600',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="size-4" strokeWidth={2.5} /> : <span>{s.short}</span>}
                </div>
                <span
                  className={cn(
                    'line-clamp-2 text-center text-[10px] font-semibold leading-tight sm:text-[11px]',
                    active ? 'text-[#102A43]' : 'text-slate-500',
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < WIZARD_STEPS.length - 1 ? (
                <ChevronRight className="mt-1 hidden size-4 shrink-0 text-slate-300 sm:block" aria-hidden />
              ) : null}
            </Fragment>
          )
        })}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#1F5A4C] via-emerald-600 to-teal-500 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-center text-[11px] text-slate-500">
        Paso {currentStep} de {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep - 1]?.label}
      </p>
    </div>
  )
}

export function BulkImportWizard() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  const callerIsSuper = profile?.role === 'super_admin'

  const fileInputRef = useRef<HTMLInputElement>(null)
  const importAbortRef = useRef<AbortController | null>(null)

  const [step, setStep] = useState(1)
  const [maxReachableStep, setMaxReachableStep] = useState(1)

  const [auditTournamentId, setAuditTournamentId] = useState('')
  const [createMissingCategories, setCreateMissingCategories] = useState(true)
  const [parsedRows, setParsedRows] = useState<BulkImportParsedRow[] | null>(null)
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkImportMergedResponse | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all')
  const [importProgress, setImportProgress] = useState<{
    completedRows: number
    totalRows: number
    chunkIndex: number
    chunkTotal: number
    phase: string
  } | null>(null)

  const tournamentsQ = useQuery({
    queryKey: ['bulk-import-tournaments'],
    queryFn: listTournamentsForBulkImport,
  })

  const contextQ = useQuery({
    queryKey: ['bulk-import-pool-context', auditTournamentId || 'none'],
    queryFn: () => fetchBulkImportPoolContext(auditTournamentId.trim() || null),
    enabled: isAdminRole(profile?.role) && Boolean(parsedRows?.length),
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

  const summary = useMemo(() => (preview?.length ? buildBulkImportPreviewSummary(preview) : null), [preview])
  const filteredPreview = useMemo(() => (preview ? filterPreviewRows(preview, previewFilter) : []), [preview, previewFilter])

  const hasBlockingErrors = preview?.some((r) => r.state === 'error') ?? false
  const canProceedToConfirm = Boolean(preview?.length && !hasBlockingErrors && summary && summary.importableRows > 0)
  const selectedTournamentName = useMemo(() => {
    if (!auditTournamentId.trim()) return null
    return tournamentsQ.data?.find((t) => t.id === auditTournamentId)?.name ?? 'Torneo'
  }, [auditTournamentId, tournamentsQ.data])

  /** Texto del trigger alineado con cada SelectItem (nombre · estado). */
  const auditTournamentSelectLabel = useMemo(() => {
    if (!auditTournamentId.trim()) return undefined
    const t = tournamentsQ.data?.find((x) => x.id === auditTournamentId)
    if (!t) return undefined
    return `${t.name} · ${tournamentStatusLabel(t.status)}`
  }, [auditTournamentId, tournamentsQ.data])

  const bumpReachable = useCallback((n: number) => {
    setMaxReachableStep((prev) => Math.max(prev, n))
  }, [])

  const resetAll = useCallback(() => {
    importAbortRef.current?.abort()
    importAbortRef.current = null
    setStep(1)
    setMaxReachableStep(1)
    setAuditTournamentId('')
    setCreateMissingCategories(true)
    setParsedRows(null)
    setFileMeta(null)
    setParseError(null)
    setResult(null)
    setPreviewFilter('all')
    setImportProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const importMut = useMutation({
    mutationFn: async () => {
      if (!preview?.length) throw new Error('Sin datos')
      importAbortRef.current?.abort()
      const ac = new AbortController()
      importAbortRef.current = ac

      const rows: BulkImportInvokeRow[] = preview
        .filter((r) => r.state !== 'error')
        .map((r) => ({
          rowNumber: r.rowNumber,
          externalId: r.externalId,
          phone: r.phone,
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
      setImportProgress({ completedRows: 0, totalRows: rows.length, chunkIndex: 0, chunkTotal: 1, phase: 'Iniciando…' })

      return invokeBulkCreateUsersChunked(
        {
          tournamentId: tid,
          fileName: fileMeta?.name,
          createMissingCategories,
          rows,
          signal: ac.signal,
        },
        {
          onProgress: (info) => {
            const label =
              info.phase === 'upload'
                ? `Enviando lote ${info.chunkIndex + 1} de ${info.chunkTotal}…`
                : `Lote ${info.chunkIndex} de ${info.chunkTotal} guardado`
            setImportProgress({
              completedRows: info.completedRows,
              totalRows: info.totalRows,
              chunkIndex: info.chunkIndex,
              chunkTotal: info.chunkTotal,
              phase: label,
            })
          },
        },
      )
    },
    onSuccess: async (data) => {
      importAbortRef.current = null
      setResult(data)
      setImportProgress(null)
      setStep(5)
      bumpReachable(5)
      toast.success(`Importación terminada: ${data.success} correctos, ${data.errors} con error en servidor`)
      await qc.invalidateQueries({ queryKey: ['admin-users'] })
      await qc.invalidateQueries({ queryKey: ['admin-groups'] })
      await qc.invalidateQueries({ queryKey: ['bulk-import-pool-context'] })
      await qc.invalidateQueries({ queryKey: ['player-categories'] })
    },
    onError: (e) => {
      importAbortRef.current = null
      setImportProgress(null)
      if (isAbortError(e)) {
        toast.message('Importación cancelada')
        setStep(3)
        return
      }
      toast.error(e instanceof Error ? e.message : 'Error en importación')
      setStep(4)
    },
  })

  const cancelRunningImport = () => {
    importAbortRef.current?.abort()
  }

  const onPickFile = useCallback(async (f: File | null) => {
    setResult(null)
    setParseError(null)
    if (!f) return
    try {
      const rows = await parseUserImportFile(f)
      setParsedRows(rows)
      setFileMeta({ name: f.name, size: f.size })
      bumpReachable(1)
      toast.success(`Archivo listo: ${rows.length} filas detectadas`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo leer el archivo'
      toast.error(msg)
      setParseError(msg)
      setParsedRows(null)
      setFileMeta(null)
    }
  }, [bumpReachable])

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
      Celular: r.phone ?? '',
      Contraseña: r.temporaryPassword === '—' ? '(sin cambio)' : r.temporaryPassword,
      Categoría: r.categoryName,
      Acción: r.operation === 'updated' ? 'Actualizado' : 'Creado',
    }))
    downloadBulkCredentialsCsv(rows)
  }

  const goValidation = () => {
    if (!fileMeta || !parsedRows?.length) return
    setStep(2)
    bumpReachable(2)
  }

  const goConfirm = () => {
    if (!canProceedToConfirm) return
    setStep(3)
    bumpReachable(3)
  }

  const startImport = () => {
    setStep(4)
    bumpReachable(4)
    importMut.mutate()
  }

  const roleLabel = (r: string) => userRoleLabelEs(r as UserRole)

  if (!isAdminRole(profile?.role)) {
    return (
      <Card className="rounded-2xl border border-slate-200">
        <CardContent className="flex items-center gap-3 p-6 text-sm text-slate-600">
          <ShieldCheck className="size-5 text-amber-600" />
          Solo administradores pueden usar la carga masiva.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200/90 shadow-sm ring-1 ring-slate-900/[0.04]',
        importMut.isPending && 'ring-2 ring-[#1F5A4C]/20',
      )}
    >
      <div className="h-1 w-full bg-gradient-to-r from-[#1F5A4C] via-emerald-600 to-teal-500" aria-hidden />
      <CardHeader className="border-b border-slate-200/80 bg-slate-50/50 pb-5">
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base font-semibold text-slate-900">Importación masiva de usuarios</CardTitle>
              <CardDescription className="max-w-2xl text-slate-600">
                Asistente guiado: archivo → validación → confirmación → importación con progreso → resultados descargables.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => downloadUserImportTemplate()}>
                <Download className="size-4" />
                Plantilla CSV
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-slate-600" onClick={resetAll} disabled={importMut.isPending}>
                <X className="size-4" />
                Reiniciar
              </Button>
            </div>
          </div>

          <WizardStepper currentStep={step} maxReachable={maxReachableStep} />

          <details className="rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-sm">
            <summary className="cursor-pointer list-none font-medium text-slate-700 outline-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <Info className="size-4 text-[#1F5A4C]" aria-hidden />
                Cómo funciona la importación
              </span>
            </summary>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-slate-600">
              <li>Si el ID coincide con un usuario existente, la fila actualiza datos; la contraseña solo cambia si incluyes 8 dígitos válidos.</li>
              <li>Con torneo seleccionado, los grupos del archivo se validan y pueden crearse automáticamente.</li>
              <li>La importación grande se divide en lotes: verás el progreso fila a fila agregada por lote.</li>
            </ul>
          </details>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Step 1 — Archivo */}
        {step === 1 ? (
          <div className="space-y-6">
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
                  <SelectTrigger className="h-11 min-w-[180px] w-auto border-slate-200 bg-white">
                    <SelectValue placeholder="Ninguno">{auditTournamentSelectLabel ?? undefined}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" label="Ninguno (pool global)">
                      Ninguno (pool global)
                    </SelectItem>
                    {(tournamentsQ.data ?? []).map((t) => {
                      const rowLabel = `${t.name} · ${tournamentStatusLabel(t.status)}`
                      return (
                        <SelectItem key={t.id} value={t.id} label={rowLabel}>
                          {rowLabel}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">Necesario si el archivo asigna grupos a un torneo concreto.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700">Archivo de datos</Label>
                <input ref={fileInputRef} id="bulk-wizard-file" type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={onFileInputChange} />
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
                    'flex min-h-[7rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors',
                    isDraggingFile ? 'border-[#1F5A4C] bg-emerald-50/60' : 'border-slate-200 bg-slate-50/40 hover:border-slate-300',
                  )}
                >
                  <Upload className="size-8 text-slate-400" aria-hidden />
                  {fileMeta ? (
                    <div className="text-center">
                      <p className="font-semibold text-slate-900">{fileMeta.name}</p>
                      <p className="text-xs text-slate-500">{formatBytes(fileMeta.size)}</p>
                    </div>
                  ) : (
                    <div className="text-center text-sm text-slate-600">
                      <span className="font-medium text-slate-800">Arrastra o haz clic</span>
                      <span className="mt-1 block text-xs text-slate-500">CSV, XLS o XLSX · primera hoja para Excel</span>
                    </div>
                  )}
                </div>
                {parseError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-900">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{parseError}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 text-[#1F5A4C] focus:ring-[#1F5A4C]"
                checked={createMissingCategories}
                onChange={(e) => setCreateMissingCategories(e.target.checked)}
              />
              Crear categorías de jugador que no existan todavía
            </label>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <Button type="button" className="gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90" disabled={!fileMeta || !parsedRows?.length} onClick={goValidation}>
                Continuar a validación
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {/* Step 2 — Validación */}
        {step === 2 ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <FileSpreadsheet className="size-9 shrink-0 text-[#1F5A4C]" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Archivo cargado</p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-800">{fileMeta?.name}</span>
                    {fileMeta ? ` · ${formatBytes(fileMeta.size)}` : null}
                    {parsedRows ? ` · ${parsedRows.length} filas en bruto` : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    Torneo: {selectedTournamentName ? <span className="font-medium text-slate-700">{selectedTournamentName}</span> : 'pool global (sin grupo en servidor salvo que el archivo no pida grupo)'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ClipboardList className="size-4 text-slate-500" />
                Columnas reconocidas en el archivo
              </p>
              <p className="mb-3 text-xs text-slate-500">
                Los encabezados pueden variar ligeramente; el sistema busca estas etiquetas (sin importar mayúsculas ni acentos en el nombre de columna).
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {BULK_IMPORT_COLUMN_GUIDE.map((col) => (
                  <div key={col.field} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
                    <p className="font-semibold text-slate-800">{col.field}</p>
                    <p className="text-slate-500">Encabezados: {col.headers}</p>
                    <p className="mt-1 text-slate-600">{col.hint}</p>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {typeof col.required === 'string' ? col.required : col.required ? 'Obligatorio' : 'Opcional'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {contextQ.isFetching ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4 text-sm text-slate-700">
                <Loader2 className="size-5 animate-spin text-[#1F5A4C]" />
                Consultando categorías existentes, IDs y grupos del torneo…
              </div>
            ) : null}

            {contextQ.isError ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-900">
                <AlertTriangle className="size-5 shrink-0" />
                No se pudo cargar el contexto de validación. Revisa la conexión e inténtalo de nuevo.
              </div>
            ) : null}

            {summary && preview ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Listas para importar', value: summary.ready, tone: 'emerald' },
                    { label: 'Con avisos (sí se importan)', value: summary.warning, tone: 'amber' },
                    { label: 'Bloqueadas por error', value: summary.error, tone: 'red' },
                    { label: 'Total filas', value: summary.totalRows, tone: 'slate' },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-center shadow-sm',
                        m.tone === 'emerald' && 'border-emerald-200/80 bg-emerald-50/50',
                        m.tone === 'amber' && 'border-amber-200/80 bg-amber-50/40',
                        m.tone === 'red' && 'border-red-200/80 bg-red-50/40',
                        m.tone === 'slate' && 'border-slate-200 bg-white',
                      )}
                    >
                      <p className="text-2xl font-bold tabular-nums text-slate-900">{m.value}</p>
                      <p className="text-[11px] font-medium text-slate-600">{m.label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Altas vs actualizaciones (estimado)</p>
                    <div className="mt-2 flex gap-6 text-sm">
                      <span>
                        <span className="font-bold text-emerald-700">{summary.likelyCreates}</span>{' '}
                        <span className="text-slate-600">altas nuevas</span>
                      </span>
                      <span>
                        <span className="font-bold text-slate-800">{summary.likelyUpdates}</span>{' '}
                        <span className="text-slate-600">actualizaciones</span>
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categorías / grupos nuevos (si aplica)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {summary.newCategoryNames.length ? (
                        summary.newCategoryNames.map((c) => (
                          <span key={c} className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-medium text-violet-900">
                            Categoría: {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">Ninguna categoría nueva</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {summary.newGroupNames.length ? (
                        summary.newGroupNames.map((g) => (
                          <span key={g} className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-medium text-sky-900">
                            Grupo: {g}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">Ningún grupo nuevo previsto</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Detalle por fila</p>
                    <div className="flex flex-wrap gap-2">
                      {(['all', 'ready', 'warning', 'error'] as PreviewFilter[]).map((f) => (
                        <Button
                          key={f}
                          type="button"
                          size="sm"
                          variant={previewFilter === f ? 'default' : 'outline'}
                          className={cn('h-8 text-xs', previewFilter === f && 'bg-slate-900')}
                          onClick={() => setPreviewFilter(f)}
                        >
                          {f === 'all' ? 'Todas' : f === 'ready' ? 'Listas' : f === 'warning' ? 'Avisos' : 'Errores'}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <ScrollArea className="h-[min(22rem,50vh)] rounded-xl border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/95 hover:bg-slate-50/95">
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Celular</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="min-w-[12rem]">Validación</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPreview.map((r) => (
                          <TableRow
                            key={r.rowNumber}
                            className={cn(
                              r.state === 'error' && 'bg-red-50/40',
                              r.state === 'warning' && 'bg-amber-50/30',
                            )}
                          >
                            <TableCell className="tabular-nums text-slate-500">{r.rowNumber}</TableCell>
                            <TableCell className="font-mono text-xs">{r.externalId || '—'}</TableCell>
                            <TableCell className="font-mono text-xs tabular-nums">{r.phone || '—'}</TableCell>
                            <TableCell className="text-sm">{r.fullName}</TableCell>
                            <TableCell className="text-sm">{roleLabel(r.role)}</TableCell>
                            <TableCell className="text-sm">{r.categoryName}</TableCell>
                            <TableCell className="text-sm">{r.groupName || '—'}</TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                  r.state === 'ready' && 'bg-emerald-100 text-emerald-800',
                                  r.state === 'warning' && 'bg-amber-100 text-amber-900',
                                  r.state === 'error' && 'bg-red-100 text-red-800',
                                )}
                              >
                                {r.state === 'ready' ? 'Lista' : r.state === 'warning' ? 'Aviso' : 'Error'}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">{r.messages.join(' · ') || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <p className="text-[11px] text-slate-500">
                    Mostrando {filteredPreview.length} de {preview.length} filas. Las filas en error no se envían al servidor; corrige el archivo y vuelve a subirlo desde el paso 1.
                  </p>
                </div>
              </>
            ) : !contextQ.isFetching ? (
              <p className="text-sm text-slate-600">No hay vista previa. Vuelve al paso 1 y selecciona un archivo válido.</p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" className="gap-2" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" />
                Atrás
              </Button>
              <Button
                type="button"
                className="gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90"
                disabled={!canProceedToConfirm}
                onClick={goConfirm}
              >
                Continuar a confirmación
                <ArrowRight className="size-4" />
              </Button>
            </div>
            {hasBlockingErrors ? (
              <p className="flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle className="size-4 shrink-0" />
                Hay filas con error: corrige el archivo y repite desde el paso 1, o ajusta torneo / categorías.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Step 3 — Confirmación */}
        {step === 3 ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 text-sm text-amber-950">
              <p className="font-semibold">Revisa antes de ejecutar</p>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                Se enviarán <strong>{summary?.importableRows ?? 0}</strong> filas al servidor en uno o varios lotes. Las operaciones modifican perfiles reales; las contraseñas nuevas sustituyen las anteriores cuando indiques 8 dígitos.
              </p>
            </div>

            <ul className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">Archivo</span>
                <span className="max-w-[60%] text-right font-medium text-slate-900">{fileMeta?.name}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">Torneo de contexto</span>
                <span className="text-right font-medium text-slate-900">{selectedTournamentName ?? 'Ninguno (global)'}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">Crear categorías faltantes</span>
                <span className="font-medium text-slate-900">{createMissingCategories ? 'Sí' : 'No'}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">Filas a procesar</span>
                <span className="font-medium text-slate-900">{summary?.importableRows ?? 0}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-slate-500">Lotes estimados</span>
                <span className="font-medium text-slate-900">
                  {summary ? Math.ceil(summary.importableRows / 40) : '—'} (máx. 40 filas por petición)
                </span>
              </li>
            </ul>

            {summary && (summary.newCategoryNames.length > 0 || summary.newGroupNames.length > 0) ? (
              <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4 text-sm">
                <p className="font-semibold text-violet-950">Se crearán en el servidor (si el lote lo confirma)</p>
                {summary.newCategoryNames.length ? <p className="mt-1 text-xs text-violet-900">Categorías: {summary.newCategoryNames.join(', ')}</p> : null}
                {summary.newGroupNames.length ? <p className="mt-1 text-xs text-violet-900">Grupos: {summary.newGroupNames.join(', ')}</p> : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" className="gap-2" onClick={() => setStep(2)}>
                <ArrowLeft className="size-4" />
                Volver a validación
              </Button>
              <Button type="button" className="gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90" onClick={startImport}>
                <Upload className="size-4" />
                Iniciar importación
              </Button>
            </div>
          </div>
        ) : null}

        {/* Step 4 — Importación */}
        {step === 4 ? (
          <div className="space-y-6 py-4">
            {importMut.isPending || importProgress ? (
              <>
                <div className="mx-auto max-w-md text-center">
                  <Loader2 className="mx-auto size-10 animate-spin text-[#1F5A4C]" />
                  <p className="mt-4 text-base font-semibold text-slate-900">Importando usuarios…</p>
                  <p className="mt-1 text-sm text-slate-600">{importProgress?.phase ?? 'Preparando envío…'}</p>
                </div>
                {importProgress && importProgress.totalRows > 0 ? (
                  <div className="mx-auto max-w-lg space-y-2">
                    <div className="flex justify-between text-xs font-medium text-slate-600">
                      <span>Progreso por filas</span>
                      <span className="tabular-nums">
                        {importProgress.completedRows} / {importProgress.totalRows}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1F5A4C] to-emerald-500 transition-[width] duration-300"
                        style={{
                          width: `${Math.min(100, (importProgress.completedRows / importProgress.totalRows) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-center text-[11px] text-slate-500">
                      Lotes: {importProgress.chunkTotal} · Completadas: {importProgress.completedRows} filas
                    </p>
                  </div>
                ) : null}
                <div className="flex justify-center">
                  <Button type="button" variant="outline" className="gap-2 border-red-200 text-red-800 hover:bg-red-50" onClick={cancelRunningImport}>
                    <CircleStop className="size-4" />
                    Cancelar
                  </Button>
                </div>
              </>
            ) : importMut.isError ? (
              <div className="text-center text-sm text-red-700">Algo falló; puedes volver atrás e intentar de nuevo.</div>
            ) : null}
          </div>
        ) : null}

        {/* Step 5 — Resultado */}
        {step === 5 && result ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/80 to-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="size-6 text-emerald-600" />
                <span className="text-lg font-semibold text-slate-900">Importación finalizada</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {result.batchIds.length > 1
                  ? `Varios lotes en servidor (${result.batchIds.length} referencias). Primer ID de lote: ${result.batchId.slice(0, 8)}…`
                  : `ID de lote: ${result.batchId.slice(0, 8)}…`}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-emerald-700">{result.success}</p>
                  <p className="text-xs font-medium text-slate-500">Correctos</p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-red-600">{result.errors}</p>
                  <p className="text-xs font-medium text-slate-500">Fallidos en servidor</p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-slate-800">{result.results.length}</p>
                  <p className="text-xs font-medium text-slate-500">Respuestas devueltas</p>
                </div>
              </div>
            </div>

            {result.results.some((r) => r.status === 'error') ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Registros que fallaron en el servidor</p>
                <ScrollArea className="h-[min(14rem,40vh)] rounded-xl border border-red-200/60 bg-red-50/20">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-red-50/80">
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Celular</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.results
                        .filter((r) => r.status === 'error')
                        .map((r) => (
                          <TableRow key={`${r.rowNumber}-${r.externalId}-${r.phone}`}>
                            <TableCell className="tabular-nums">{r.rowNumber}</TableCell>
                            <TableCell className="font-mono text-xs">{r.externalId || '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{r.phone ?? '—'}</TableCell>
                            <TableCell>{r.fullName}</TableCell>
                            <TableCell className="text-xs text-red-800">{r.error ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            ) : (
              <p className="text-sm text-emerald-800">No hubo errores reportados por el servidor en esta ejecución.</p>
            )}

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button type="button" className="gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90" onClick={downloadCreds}>
                <FileSpreadsheet className="size-4" />
                Descargar credenciales (éxitos)
              </Button>
              <Button type="button" variant="outline" className="gap-2" onClick={() => downloadImportReportCsv(result, fileMeta?.name ?? '')}>
                <Download className="size-4" />
                Descargar informe completo (CSV)
              </Button>
              <Button type="button" variant="secondary" onClick={resetAll}>
                Nueva importación
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              El informe completo incluye cada fila devuelta por el servidor (éxitos y errores). Las credenciales solo listan filas correctas.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
