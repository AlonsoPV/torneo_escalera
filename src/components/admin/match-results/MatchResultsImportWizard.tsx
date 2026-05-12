import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { downloadMatchResultsImportTemplate, MATCH_RESULTS_IMPORT_COLUMN_GUIDE } from '@/lib/matchResultsImportSpec'
import { isAdminRole } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { getAdminGroups, getAdminMatches } from '@/services/admin'
import {
  applyMatchResultsImport,
  buildMatchResultsImportPreview,
  parseMatchResultsCsv,
  type ApplyMatchResultsImportResult,
  type MatchResultsImportPreviewRow,
} from '@/services/bulkMatchResultsImport'
import { useAuthStore } from '@/stores/authStore'

const WIZARD_STEPS = [
  { id: 1, label: 'Archivo', short: '1' },
  { id: 2, label: 'Validación', short: '2' },
  { id: 3, label: 'Confirmación', short: '3' },
  { id: 4, label: 'Importación', short: '4' },
  { id: 5, label: 'Resultado', short: '5' },
] as const

type PreviewFilter = 'all' | 'ready' | 'error'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function downloadMatchResultsReportCsv(res: ApplyMatchResultsImportResult, fileLabel: string) {
  const lines = [
    ['Fila', 'OK', 'Mensaje'].join(','),
    ...res.rowDetails.map((r) => {
      const cells = [String(r.rowNumber), r.ok ? 'Si' : 'No', r.message ?? '']
      return cells
        .map((c) => {
          const s = String(c)
          return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(',')
    }),
  ]
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safe = fileLabel.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'import'
  a.download = `informe-import-resultados-${safe}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function WizardStepper({ currentStep, maxReachable }: { currentStep: number; maxReachable: number }) {
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
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
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

export function MatchResultsImportWizard() {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)
  const userId = useAuthStore((s) => s.user?.id ?? null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(1)
  const [maxReachableStep, setMaxReachableStep] = useState(1)
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null)
  const [parseInfo, setParseInfo] = useState<{ parseErrors: string[]; headerErrors: string[] } | null>(null)
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [preview, setPreview] = useState<MatchResultsImportPreviewRow[]>([])
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all')
  const [result, setResult] = useState<ApplyMatchResultsImportResult | null>(null)

  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const matchesQ = useQuery({ queryKey: ['admin-matches'], queryFn: () => getAdminMatches() })
  const loadingContext = groupsQ.isLoading || matchesQ.isLoading

  const bumpReachable = useCallback((n: number) => {
    setMaxReachableStep((prev) => Math.max(prev, n))
  }, [])

  useEffect(() => {
    if (!parsedRows.length || !groupsQ.data || !matchesQ.data) {
      setPreview([])
      return
    }
    let cancelled = false
    buildMatchResultsImportPreview(parsedRows, groupsQ.data, matchesQ.data).then((rows) => {
      if (!cancelled) setPreview(rows)
    })
    return () => {
      cancelled = true
    }
  }, [parsedRows, groupsQ.data, matchesQ.data])

  const summary = useMemo(() => {
    const ready = preview.filter((r) => r.state === 'ready').length
    const err = preview.filter((r) => r.state === 'error').length
    return { ready, error: err, total: preview.length }
  }, [preview])

  const filteredPreview = useMemo(() => {
    if (previewFilter === 'ready') return preview.filter((r) => r.state === 'ready')
    if (previewFilter === 'error') return preview.filter((r) => r.state === 'error')
    return preview
  }, [preview, previewFilter])

  const hasHeaderErrors = Boolean(parseInfo?.headerErrors.length)
  const canGoValidation =
    Boolean(fileMeta && parsedRows.length > 0 && !hasHeaderErrors)
  const canProceedToConfirm = summary.ready > 0 && !loadingContext && preview.length > 0

  const resetAll = useCallback(() => {
    setStep(1)
    setMaxReachableStep(1)
    setFileMeta(null)
    setParseInfo(null)
    setParsedRows([])
    setPreview([])
    setPreviewFilter('all')
    setResult(null)
    setIsDraggingFile(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const onPickFile = useCallback(
    (file: File | null) => {
      setResult(null)
      if (!file) return
      const lower = file.name.toLowerCase()
      if (!lower.endsWith('.csv') && file.type !== 'text/csv') {
        toast.error('Usa un archivo .csv (UTF-8)')
        return
      }
      setFileMeta({ name: file.name, size: file.size })
      const reader = new FileReader()
      reader.onload = () => {
        const text = String(reader.result ?? '')
        const { rows, parseErrors, headerErrors } = parseMatchResultsCsv(text)
        setParseInfo({ parseErrors, headerErrors })
        if (headerErrors.length) {
          setParsedRows([])
          setPreview([])
          toast.error('Revisa las columnas del CSV')
          bumpReachable(1)
          return
        }
        setParsedRows(rows)
        if (parseErrors.length) toast.warning('Hubo avisos al leer el CSV')
        else toast.success(`${rows.length} fila(s) de datos`)
        bumpReachable(1)
      }
      reader.readAsText(file, 'UTF-8')
    },
    [bumpReachable],
  )

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPickFile(e.target.files?.[0] ?? null)
  }

  const onDropFile = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    onPickFile(f)
  }

  const importMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('No autenticado')
      return applyMatchResultsImport({
        fileName: fileMeta?.name ?? null,
        uploadedBy: userId,
        rows: preview,
      })
    },
    onSuccess: async (res) => {
      setResult(res)
      setStep(5)
      bumpReachable(5)
      toast.success(`Importación terminada: ${res.success} ok, ${res.errors} con error.`)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
        qc.invalidateQueries({ queryKey: ['admin-results'] }),
        qc.invalidateQueries({ queryKey: ['admin-groups'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard'] }),
        qc.invalidateQueries({ queryKey: ['matches'] }),
      ])
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Error al importar')
      setStep(3)
    },
  })

  const goValidation = () => {
    if (!canGoValidation) return
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

  if (!isAdminRole(profile?.role)) {
    return (
      <Card className="rounded-2xl border border-slate-200">
        <CardContent className="flex items-center gap-3 p-6 text-sm text-slate-600">
          <ShieldCheck className="size-5 text-amber-600" />
          Solo administradores pueden importar resultados.
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
              <CardTitle className="text-base font-semibold text-slate-900">Importación de resultados (CSV)</CardTitle>
              <CardDescription className="max-w-2xl text-slate-600">
                Una fila por partido ya existente (round robin). Archivo → validación contra torneos/grupos → confirmación
                → aplicación en base de datos → informe descargable.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => downloadMatchResultsImportTemplate()}>
                <Download className="size-4" />
                Plantilla CSV
              </Button>
              <Link
                to="/admin/matches"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'sm',
                  className: 'inline-flex h-8 items-center justify-center gap-2 px-3',
                })}
              >
                Partidos
              </Link>
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
                Reglas rápidas
              </span>
            </summary>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-slate-600">
              <li>No se crean partidos nuevos: el cruce debe existir en el grupo.</li>
              <li>Los marcadores cerrados en la app prevalecen según las políticas del torneo; esta herramienta actualiza filas ya generadas.</li>
              <li>UTF-8; encabezados exactos como en la plantilla (ver columnas en el paso 2).</li>
            </ul>
          </details>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {step === 1 ? (
          <div className="space-y-6">
            <input ref={fileInputRef} id="match-results-wizard-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={onFileInputChange} />
            <div className="space-y-2">
              <Label className="text-slate-700">Archivo CSV</Label>
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
                    <span className="mt-1 block text-xs text-slate-500">.csv · UTF-8</span>
                  </div>
                )}
              </div>
            </div>

            {parseInfo && (parseInfo.headerErrors.length > 0 || parseInfo.parseErrors.length > 0) ? (
              <div
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs',
                  parseInfo.headerErrors.length > 0 ? 'border-red-200 bg-red-50/80 text-red-900' : 'border-amber-200 bg-amber-50/70 text-amber-950',
                )}
              >
                <ul className="list-inside list-disc space-y-1">
                  {parseInfo.headerErrors.map((msg, i) => (
                    <li key={`h-${i}`}>{msg}</li>
                  ))}
                  {parseInfo.parseErrors.slice(0, 12).map((msg, i) => (
                    <li key={`p-${i}`}>{msg}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <Button type="button" className="gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90" disabled={!canGoValidation} onClick={goValidation}>
                Continuar a validación
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

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
                    {parsedRows.length ? ` · ${parsedRows.length} filas en bruto` : null}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ClipboardList className="size-4 text-slate-500" />
                Columnas esperadas
              </p>
              <p className="mb-3 text-xs text-slate-500">
                El archivo debe incluir exactamente estas columnas en la primera fila (orden libre no soportado: usa la
                plantilla).
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {MATCH_RESULTS_IMPORT_COLUMN_GUIDE.map((col) => (
                  <div key={col.field} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
                    <p className="font-mono text-[11px] font-semibold text-slate-800">{col.field}</p>
                    {col.hint ? <p className="mt-1 text-slate-600">{col.hint}</p> : null}
                  </div>
                ))}
              </div>
            </div>

            {loadingContext ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4 text-sm text-slate-700">
                <Loader2 className="size-5 animate-spin text-[#1F5A4C]" />
                Cargando grupos y partidos del sistema para validar filas…
              </div>
            ) : null}

            {groupsQ.isError || matchesQ.isError ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-900">
                <AlertTriangle className="size-5 shrink-0" />
                No se pudo cargar el contexto. Revisa la conexión e inténtalo de nuevo.
              </div>
            ) : null}

            {!loadingContext && preview.length > 0 ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Listas para aplicar', value: summary.ready, tone: 'emerald' as const },
                    { label: 'Con error (no se envían)', value: summary.error, tone: 'red' as const },
                    { label: 'Total filas', value: summary.total, tone: 'slate' as const },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-center shadow-sm',
                        m.tone === 'emerald' && 'border-emerald-200/80 bg-emerald-50/50',
                        m.tone === 'red' && 'border-red-200/80 bg-red-50/40',
                        m.tone === 'slate' && 'border-slate-200 bg-white',
                      )}
                    >
                      <p className="text-2xl font-bold tabular-nums text-slate-900">{m.value}</p>
                      <p className="text-[11px] font-medium text-slate-600">{m.label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Detalle por fila</p>
                    <div className="flex flex-wrap gap-2">
                      {(['all', 'ready', 'error'] as PreviewFilter[]).map((f) => (
                        <Button
                          key={f}
                          type="button"
                          size="sm"
                          variant={previewFilter === f ? 'default' : 'outline'}
                          className={cn('h-8 text-xs', previewFilter === f && 'bg-slate-900')}
                          onClick={() => setPreviewFilter(f)}
                        >
                          {f === 'all' ? 'Todas' : f === 'ready' ? 'Listas' : 'Errores'}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <ScrollArea className="h-[min(22rem,50vh)] rounded-xl border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/95 hover:bg-slate-50/95">
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Torneo / Grupo</TableHead>
                          <TableHead className="min-w-[12rem]">Mensajes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPreview.map((r) => (
                          <TableRow
                            key={r.rowNumber}
                            className={cn(r.state === 'error' && 'bg-red-50/40', r.state === 'ready' && 'bg-emerald-50/20')}
                          >
                            <TableCell className="tabular-nums text-slate-500">{r.rowNumber}</TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                  r.state === 'ready' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
                                )}
                              >
                                {r.state === 'ready' ? 'Lista' : 'Error'}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[16rem] truncate text-xs">
                              {r.cells.tournament_name} · {r.cells.group_name}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">{r.messages.length ? r.messages.join(' · ') : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <p className="text-[11px] text-slate-500">
                    Mostrando {filteredPreview.length} de {preview.length} filas. Corrige el CSV y vuelve al paso 1 si
                    necesitas cambiar encabezados o datos.
                  </p>
                </div>
              </>
            ) : !loadingContext && parsedRows.length > 0 ? (
              <p className="text-sm text-slate-600">Generando vista previa…</p>
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
            {summary.error > 0 ? (
              <p className="flex items-center gap-2 text-sm text-amber-800">
                <AlertTriangle className="size-4 shrink-0" />
                Hay filas con error: solo las «listas» se aplicarán en el servidor.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 text-sm text-amber-950">
              <p className="font-semibold">Revisa antes de ejecutar</p>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                Se actualizarán hasta <strong>{summary.ready}</strong> partido(s) en base de datos según el archivo. Las
                filas en estado error se registrarán como fallidas en el informe del lote.
              </p>
            </div>

            <ul className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">Archivo</span>
                <span className="max-w-[60%] text-right font-medium text-slate-900">{fileMeta?.name}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">Filas listas</span>
                <span className="font-medium text-slate-900">{summary.ready}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">Filas con error</span>
                <span className="font-medium text-slate-900">{summary.error}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-slate-500">Total filas en archivo</span>
                <span className="font-medium text-slate-900">{summary.total}</span>
              </li>
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" className="gap-2" onClick={() => setStep(2)}>
                <ArrowLeft className="size-4" />
                Volver a validación
              </Button>
              <Button
                type="button"
                className="gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90"
                disabled={!userId || summary.ready === 0}
                onClick={startImport}
              >
                <Upload className="size-4" />
                Iniciar importación
              </Button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-6 py-4">
            {importMut.isPending ? (
              <div className="mx-auto max-w-md text-center">
                <Loader2 className="mx-auto size-10 animate-spin text-[#1F5A4C]" />
                <p className="mt-4 text-base font-semibold text-slate-900">Aplicando resultados…</p>
                <p className="mt-1 text-sm text-slate-600">Esto puede tardar unos segundos según el número de filas.</p>
              </div>
            ) : importMut.isError ? (
              <div className="text-center text-sm text-red-700">
                <p>No se completó la importación.</p>
                <Button type="button" variant="outline" className="mt-4 gap-2" onClick={() => setStep(3)}>
                  <ArrowLeft className="size-4" />
                  Volver
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 5 && result ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/80 to-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="size-6 text-emerald-600" />
                <span className="text-lg font-semibold text-slate-900">Importación finalizada</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">ID de lote: {result.batchId.slice(0, 8)}…</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-emerald-700">{result.success}</p>
                  <p className="text-xs font-medium text-slate-500">Correctos</p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-red-600">{result.errors}</p>
                  <p className="text-xs font-medium text-slate-500">Fallidos</p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-slate-800">{result.rowDetails.length}</p>
                  <p className="text-xs font-medium text-slate-500">Filas informadas</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => downloadMatchResultsReportCsv(result, fileMeta?.name ?? 'resultados')}
              >
                <Download className="size-4" />
                Descargar informe CSV
              </Button>
              <Link
                to="/admin/results"
                className={buttonVariants({ variant: 'outline', size: 'sm', className: 'inline-flex h-8 items-center gap-2 px-3' })}
              >
                Revisar resultados
              </Link>
            </div>

            <Button type="button" variant="ghost" className="text-slate-600" onClick={resetAll}>
              Importar otro archivo
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
