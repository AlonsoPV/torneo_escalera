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
import { downloadMatchResultsExportCsv } from '@/lib/matchResultsExport'
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
import {
  prepareMatchResultsImport,
  type PrepareMatchResultsImportResult,
} from '@/services/matchResultsImportPrepare'

/** Resultado de la mutación de importación (aplica + metadatos de preparación). */
type MatchResultsImportOutcome = ApplyMatchResultsImportResult & {
  roundRobinInserted: number
}
import { useAuthStore } from '@/stores/authStore'
import { formatScoreCompact } from '@/utils/score'

const WIZARD_STEPS = [
  { id: 1, label: 'Subir archivo', short: '1' },
  { id: 2, label: 'Validar estructura', short: '2' },
  { id: 3, label: 'Revisar resultados', short: '3' },
  { id: 4, label: 'Importar', short: '4' },
  { id: 5, label: 'Resumen final', short: '5' },
] as const

type PreviewFilter = 'all' | 'ready' | 'error' | 'warning' | 'normalized'

function previewScoreLabel(r: MatchResultsImportPreviewRow): string {
  if (r.state !== 'ready' || !r.resolved?.scoreRaw?.length) return '—'
  return formatScoreCompact(r.resolved.scoreRaw)
}

function previewWinnerLabel(r: MatchResultsImportPreviewRow): string {
  if (r.state !== 'ready' || !r.resolved?.winnerGroupPlayerId) {
    if (r.infoMessages?.some((m) => m.includes('inferido'))) return 'Inferido'
    return '—'
  }
  const raw = String(r.cells.winner_id ?? '').trim()
  if (raw && raw.length < 48) return raw
  return `${r.resolved.winnerGroupPlayerId.slice(0, 8)}…`
}

function previewRowPresentation(row: MatchResultsImportPreviewRow): {
  label: string
  rowClass: string
  badgeClass: string
} {
  if (row.state === 'error') {
    return {
      label: 'Error',
      rowClass: 'bg-red-50/40',
      badgeClass: 'bg-red-100 text-red-800',
    }
  }
  switch (row.previewKind) {
    case 'penalty':
      return {
        label: 'Penalización',
        rowClass: 'bg-amber-50/55',
        badgeClass: 'bg-amber-100 text-amber-950',
      }
    case 'warning':
      return {
        label: 'Advertencia',
        rowClass: 'bg-amber-50/25',
        badgeClass: 'bg-amber-100 text-amber-900',
      }
    case 'normalized':
      return {
        label: 'Normalizado',
        rowClass: 'bg-sky-50/35',
        badgeClass: 'bg-sky-100 text-sky-900',
      }
    default:
      return {
        label: 'Lista',
        rowClass: 'bg-emerald-50/20',
        badgeClass: 'bg-emerald-100 text-emerald-800',
      }
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function downloadMatchResultsReportCsv(res: Pick<ApplyMatchResultsImportResult, 'rowDetails'>, fileLabel: string) {
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
  const [historicalImportMode, setHistoricalImportMode] = useState(true)
  const [result, setResult] = useState<MatchResultsImportOutcome | null>(null)
  const [structureSyncing, setStructureSyncing] = useState(false)

  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)
  /** Captura del preview en el momento de iniciar importación (resumen final). */
  const importSnapshotRef = useRef<{
    pendingConverted: number
    readyWithNotes: number
    totalFileRows: number
  } | null>(null)
  const preparedRef = useRef<{
    key: string
    result: PrepareMatchResultsImportResult
  } | null>(null)

  const groupsQ = useQuery({ queryKey: ['admin-groups'], queryFn: () => getAdminGroups() })
  const matchesQ = useQuery({ queryKey: ['admin-matches'], queryFn: () => getAdminMatches() })
  const loadingContext = groupsQ.isLoading || matchesQ.isLoading

  const handleExportCurrentMatches = useCallback(() => {
    const matches = matchesQ.data ?? []
    if (!matches.length) {
      toast.error('No hay partidos disponibles para exportar.')
      return
    }
    downloadMatchResultsExportCsv(matches, 'partidos-resultados')
    toast.success(`${matches.length} partido(s) exportado(s) con la misma estructura de la plantilla.`)
  }, [matchesQ.data])

  const bumpReachable = useCallback((n: number) => {
    setMaxReachableStep((prev) => Math.max(prev, n))
  }, [])

  useEffect(() => {
    if (!parsedRows.length || !groupsQ.data || !matchesQ.data) {
      setPreview([])
      return
    }
    let cancelled = false
    buildMatchResultsImportPreview(parsedRows, groupsQ.data, matchesQ.data, { historicalImportMode }).then((rows) => {
      if (!cancelled) setPreview(rows)
    })
    return () => {
      cancelled = true
    }
  }, [parsedRows, groupsQ.data, matchesQ.data, historicalImportMode])

  const summary = useMemo(() => {
    const ready = preview.filter((r) => r.state === 'ready').length
    const err = preview.filter((r) => r.state === 'error').length
    const withNotes = preview.filter((r) => r.state === 'ready' && (r.infoMessages?.length ?? 0) > 0).length
    const normalized = preview.filter((r) => r.state === 'ready' && r.previewKind === 'normalized').length
    const warnings = preview.filter((r) => r.state === 'ready' && r.previewKind === 'warning').length
    const penalties = preview.filter((r) => r.state === 'ready' && r.previewKind === 'penalty').length
    const readyRows = preview.filter((r) => r.state === 'ready' && r.resolved)
    const countRt = (rt: string) => readyRows.filter((r) => r.resolved!.resultType === rt).length
    return {
      ready,
      error: err,
      total: preview.length,
      withNotes,
      normalized,
      warnings,
      penalties,
      normal: countRt('normal'),
      wo: countRt('wo'),
      def: countRt('def'),
      notReported: countRt('not_reported'),
      retired: countRt('retired'),
      doublePenalty: countRt('double_penalty'),
      pendingConverted: preview.filter(
        (r) =>
          r.infoMessages?.some(
            (m) =>
              m.includes('pending_score') ||
              m.includes('N.R') ||
              m.includes('penalización administrativa') ||
              m.includes('No reportado'),
          ),
      ).length,
    }
  }, [preview])

  const parsedRowsShape = useMemo(() => {
    const groups = new Map<string, number>()
    for (const row of parsedRows) {
      const key = [
        String(row.tournament_name ?? '').trim().toLowerCase(),
        String(row.category_name ?? '').trim().toLowerCase(),
        String(row.group_name ?? '').trim().toLowerCase(),
      ].join('|')
      if (!key.endsWith('|') && String(row.group_name ?? '').trim()) {
        groups.set(key, (groups.get(key) ?? 0) + 1)
      }
    }
    const groupCount = groups.size
    return {
      groupCount,
      expectedRoundRobinRows: groupCount * 10,
      completeFivePlayerGroups: [...groups.values()].filter((count) => count === 10).length,
    }
  }, [parsedRows])

  const fileLooksLikeEmptyResultsTemplate = useMemo(() => {
    if (parsedRows.length === 0) return false
    return parsedRows.every((row) => {
      const hasWinner = String(row.winner_id ?? '').trim().length > 0
      const hasAnySet = [1, 2, 3].some((i) => {
        const a = String(row[`set_${i}_a`] ?? '').trim()
        const b = String(row[`set_${i}_b`] ?? '').trim()
        return a.length > 0 || b.length > 0
      })
      const status = String(row.status ?? '').trim().toLowerCase()
      const resultType = String(row.result_type ?? '').trim().toLowerCase()
      return !hasWinner && !hasAnySet && status === 'pending_score' && resultType === 'pending_score'
    })
  }, [parsedRows])

  const prepareKey = useMemo(() => {
    if (!fileMeta || !parsedRows.length || !userId) return ''
    return `${fileMeta.name}|${fileMeta.size}|${parsedRows.length}|${userId}`
  }, [fileMeta, parsedRows.length, userId])

  const filteredPreview = useMemo(() => {
    if (previewFilter === 'ready') return preview.filter((r) => r.state === 'ready')
    if (previewFilter === 'error') return preview.filter((r) => r.state === 'error')
    if (previewFilter === 'warning')
      return preview.filter((r) => r.state === 'ready' && r.previewKind === 'warning')
    if (previewFilter === 'normalized')
      return preview.filter((r) => r.state === 'ready' && r.previewKind === 'normalized')
    return preview
  }, [preview, previewFilter])

  const hasHeaderErrors = Boolean(parseInfo?.headerErrors.length)
  const canGoValidation =
    Boolean(fileMeta && parsedRows.length > 0 && !hasHeaderErrors)
  const canProceedToConfirm =
    summary.ready > 0 && summary.error === 0 && !loadingContext && preview.length > 0

  const resetAll = useCallback(() => {
    setStep(1)
    setMaxReachableStep(1)
    setFileMeta(null)
    setParseInfo(null)
    setParsedRows([])
    setPreview([])
    setPreviewFilter('all')
    setResult(null)
    setImportProgress(null)
    setIsDraggingFile(false)
    importSnapshotRef.current = null
    preparedRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const onPickFile = useCallback(
    (file: File | null) => {
      setResult(null)
      if (!file) return
      preparedRef.current = null
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
    mutationFn: async (): Promise<MatchResultsImportOutcome> => {
      if (!userId) throw new Error('No autenticado')
      setImportProgress(null)
      const cachedPrep = preparedRef.current?.key === prepareKey ? preparedRef.current.result : null
      const prep = cachedPrep ?? await prepareMatchResultsImport(parsedRows, userId)
      if (!cachedPrep && prepareKey) preparedRef.current = { key: prepareKey, result: prep }
      const groups = await getAdminGroups()
      const matches = await getAdminMatches()
      const freshPreview = await buildMatchResultsImportPreview(parsedRows, groups, matches, {
        historicalImportMode,
      })
      const ready = freshPreview.filter((r) => r.state === 'ready').length
      const critical = freshPreview.filter((r) => r.state === 'error').length
      if (critical > 0) {
        throw new Error(
          `Hay ${critical} fila(s) con error: corrige el archivo y vuelve a validar antes de importar.`,
        )
      }
      if (ready === 0) {
        throw new Error(
          'Tras sincronizar torneo/grupos no quedó ninguna fila lista. Revisa jugadores en el grupo y cruces round robin.',
        )
      }
      const applyRes = await applyMatchResultsImport({
        fileName: fileMeta?.name ?? null,
        uploadedBy: userId,
        rows: freshPreview,
        onChunkProgress: (done, total) => setImportProgress({ done, total }),
      })
      return {
        ...applyRes,
        roundRobinInserted: prep.roundRobin.matchesInserted,
      }
    },
    onSuccess: async (res) => {
      setResult(res)
      setStep(5)
      bumpReachable(5)
      toast.success(`Importación terminada: ${res.success} guardados, ${res.errors} omitidos con error.`)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
        qc.invalidateQueries({ queryKey: ['admin-results'] }),
        qc.invalidateQueries({ queryKey: ['admin-groups'] }),
        qc.invalidateQueries({ queryKey: ['admin-overview'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard-options'] }),
        qc.invalidateQueries({ queryKey: ['matches'] }),
      ])
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Error al importar')
      setStep(3)
    },
  })

  const goValidation = async () => {
    if (!canGoValidation || !userId) return
    setStructureSyncing(true)
    try {
      const prep = await prepareMatchResultsImport(parsedRows, userId)
      if (prepareKey) preparedRef.current = { key: prepareKey, result: prep }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-groups'] }),
        qc.invalidateQueries({ queryKey: ['admin-matches'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard-options'] }),
        qc.invalidateQueries({ queryKey: ['tournament-dashboard'] }),
        qc.refetchQueries({ queryKey: ['admin-groups'] }),
        qc.refetchQueries({ queryKey: ['admin-matches'] }),
      ])
      const summaryBits = [`${prep.elapsedMs} ms`]
      if (prep.structure.categoriesCreated > 0) {
        summaryBits.push(`${prep.structure.categoriesCreated} categoría(s)`)
      }
      if (prep.structure.groupsCreated > 0) {
        summaryBits.push(`${prep.structure.groupsCreated} grupo(s) nuevo(s)`)
      }
      if (prep.structure.groupsUpdated > 0) {
        summaryBits.push(`${prep.structure.groupsUpdated} grupo(s) actualizado(s)`)
      }
      if (prep.roundRobin.matchesInserted > 0) {
        summaryBits.push(`${prep.roundRobin.matchesInserted} partido(s) RR generados`)
      }
      if (prep.enrollment.enrolled > 0) {
        summaryBits.push(`${prep.enrollment.enrolled} alta(s)`)
      }
      if (prep.enrollment.profilesAutoCreated > 0) {
        summaryBits.push(`${prep.enrollment.profilesAutoCreated} cuenta(s) nueva(s)`)
      }
      if (prep.enrollment.skippedAlreadyInGroup > 0) {
        summaryBits.push(`${prep.enrollment.skippedAlreadyInGroup} ya en grupo`)
      }
      if (prep.enrollment.rosterLabelsUpdated > 0) {
        summaryBits.push(`${prep.enrollment.rosterLabelsUpdated} nombre(s) en roster actualizados`)
      }
      if (prep.enrollment.rosterPlayersRemoved > 0) {
        summaryBits.push(`${prep.enrollment.rosterPlayersRemoved} cupo(s) liberado(s)`)
      }
      const warnings = [
        ...prep.structure.messages,
        ...prep.enrollment.messages,
        ...prep.roundRobin.messages,
      ]
      toast.success(`Preparación lista · ${summaryBits.join(' · ')}`)
      if (warnings.length > 0) {
        toast.message('Revisa estos avisos', {
          description: warnings.slice(0, 14).join('\n'),
          duration: 14_000,
        })
      }
      setStep(2)
      bumpReachable(2)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear o actualizar torneo/grupos')
    } finally {
      setStructureSyncing(false)
    }
  }

  const goConfirm = () => {
    if (!canProceedToConfirm) return
    setStep(3)
    bumpReachable(3)
  }

  const startImport = () => {
    importSnapshotRef.current = {
      pendingConverted: summary.pendingConverted,
      readyWithNotes: preview.filter((r) => r.state === 'ready' && (r.infoMessages?.length ?? 0) > 0).length,
      totalFileRows: summary.total,
    }
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
              <CardTitle className="text-base font-semibold text-slate-900">Importación de resultados</CardTitle>
              <CardDescription className="max-w-2xl text-slate-600">
                Flujo guiado como la carga masiva de usuarios: archivo CSV con la plantilla oficial → validación contra
                torneo/grupos/jugadores → revisión fila a fila → importación por lotes en servidor → informe descargable.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => downloadMatchResultsImportTemplate()}>
                <Download className="size-4" />
                Plantilla CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={matchesQ.isLoading || !(matchesQ.data?.length)}
                onClick={handleExportCurrentMatches}
              >
                <Download className="size-4" />
                Exportar partidos
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
              <li>
                Torneo / categoría / grupo del CSV se crean si no existen; los grupos ya existentes en el mismo torneo se
                reutilizan por nombre y se pueden actualizar (categoría o etiqueta) para coincidir con el archivo. El
                torneo activo no se cierra; otros torneos referenciados pasan a estado cerrado al sincronizar.
              </li>
              <li>
                Los jugadores del CSV deben tener perfil (mismo <span className="font-medium">external_id</span>, UUID o
                nombre completo). Se inscriben automáticamente en el grupo del archivo antes de validar; si ya estaban en
                el grupo, el nombre mostrado en el roster puede actualizarse desde el CSV.
              </li>
              <li>
                Si tras inscribir hay ≥2 jugadores y el grupo no tenía partidos, se generan cruces round robin en modo
                «rellenar».
              </li>
              <li>UTF-8; encabezados como en la plantilla (paso 2).</li>
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
              <Button
                type="button"
                className="gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90"
                disabled={!canGoValidation || structureSyncing || !userId}
                onClick={() => void goValidation()}
              >
                {structureSyncing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                {structureSyncing ? 'Sincronizando torneo, grupos e inscripciones…' : 'Continuar a validación'}
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

            {parsedRows.length > 0 && parsedRowsShape.groupCount > 0 && parsedRows.length === parsedRowsShape.expectedRoundRobinRows ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-950">
                Detectadas <strong>{parsedRows.length} filas</strong>: {parsedRowsShape.groupCount} grupo(s) con 10 cruces
                cada uno. La estructura del archivo es coherente para grupos de 5 jugadores.
              </p>
            ) : parsedRows.length > 0 && parsedRows.length !== 180 ? (
              <p className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-xs text-sky-950">
                Tip: un torneo con <strong>18 grupos de 5 jugadores</strong> tiene tipicamente{' '}
                <strong>18 x 10 = 180</strong> cruces round-robin. Tu archivo tiene <strong>{parsedRows.length}</strong>{' '}
                filas en <strong>{parsedRowsShape.groupCount}</strong> grupo(s). Si esperabas 20 grupos, el archivo esta
                bien; si esperabas 18, revisa grupos extra como Grupo 19 o Grupo MB.
              </p>
            ) : parsedRows.length === 180 ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-950">
                Detectadas <strong>180 filas</strong>, coherentes con 18 grupos de 5 en todos contra todos.
              </p>
            ) : null}

            {loadingContext ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4 text-sm text-slate-700">
                <Loader2 className="size-5 animate-spin text-[#1F5A4C]" />
                Cargando grupos y partidos del sistema para validar filas…
              </div>
            ) : null}

            {fileLooksLikeEmptyResultsTemplate ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">El archivo parece una plantilla sin marcadores capturados.</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    Todas las filas vienen como pending_score, sin sets y sin winner_id. Se importaran como partidos
                    abiertos para captura posterior. Si tu objetivo es importar resultados reales, llena sets/ganador o
                    cambia result_type/status.
                  </p>
                </div>
              </div>
            ) : null}

            {groupsQ.isError || matchesQ.isError ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-900">
                <AlertTriangle className="size-5 shrink-0" />
                No se pudo cargar el contexto. Revisa la conexión e inténtalo de nuevo.
              </div>
            ) : null}

            {!loadingContext ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-slate-300 text-[#1F5A4C] focus:ring-[#1F5A4C]"
                    checked={historicalImportMode}
                    onChange={(e) => setHistoricalImportMode(e.target.checked)}
                  />
                  <span>
                    <span className="font-semibold text-slate-900">Modo importación histórica activo</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                      Se aceptan formatos operativos del torneo anterior (N.R, pending_score como penalización cerrada,
                      tercer set corto, W.O/DEF/RET y marcadores flexibles). Las filas válidas quedan como «cerrado»
                      salvo canceladas. Los sets irregulares muestran advertencia en lugar de bloquear cuando hay ganador
                      coherente.
                    </span>
                  </span>
                </label>
              </div>
            ) : null}

            {!loadingContext && preview.length > 0 ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Listas para importar', value: summary.ready, tone: 'emerald' as const },
                    { label: 'Errores críticos', value: summary.error, tone: 'red' as const },
                    { label: 'Advertencias / normalizadas', value: summary.withNotes, tone: 'amber' as const },
                    { label: 'Total filas', value: summary.total, tone: 'slate' as const },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-center shadow-sm',
                        m.tone === 'emerald' && 'border-emerald-200/80 bg-emerald-50/50',
                        m.tone === 'red' && 'border-red-200/80 bg-red-50/40',
                        m.tone === 'amber' && 'border-amber-200/80 bg-amber-50/45',
                        m.tone === 'slate' && 'border-slate-200 bg-white',
                      )}
                    >
                      <p className="text-2xl font-bold tabular-nums text-slate-900">{m.value}</p>
                      <p className="text-[11px] font-medium text-slate-600">{m.label}</p>
                    </div>
                  ))}
                </div>

                {summary.withNotes > 0 ? (
                  <p className="text-xs font-medium text-amber-950">
                    {summary.withNotes} fila(s) con normalización o aviso — revisa la columna «Mensajes».
                  </p>
                ) : null}

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Detalle por fila</p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ['all', 'Todos'],
                          ['ready', 'Listas'],
                          ['normalized', 'Normalizadas'],
                          ['warning', 'Advertencias'],
                          ['error', 'Errores'],
                        ] as const
                      ).map(([f, label]) => (
                        <Button
                          key={f}
                          type="button"
                          size="sm"
                          variant={previewFilter === f ? 'default' : 'outline'}
                          className={cn('h-8 text-xs', previewFilter === f && 'bg-slate-900')}
                          onClick={() => setPreviewFilter(f)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <ScrollArea className="h-[min(22rem,50vh)] rounded-xl border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/95 hover:bg-slate-50/95">
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Validación</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Jugador A</TableHead>
                          <TableHead>Jugador B</TableHead>
                          <TableHead>Marcador</TableHead>
                          <TableHead>Ganador</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="min-w-[10rem]">Mensajes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPreview.map((r) => {
                          const pres = previewRowPresentation(r)
                          const rt = r.resolved?.resultType ?? String(r.cells.result_type ?? '—')
                          const st = r.resolved?.status ?? String(r.cells.status ?? '—')
                          return (
                          <TableRow key={r.rowNumber} className={pres.rowClass}>
                            <TableCell className="tabular-nums text-slate-500">{r.rowNumber}</TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                  pres.badgeClass,
                                )}
                              >
                                {pres.label}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[9rem] truncate text-xs">{r.cells.group_name}</TableCell>
                            <TableCell className="max-w-[8rem] truncate text-xs">{r.cells.player_a_name || '—'}</TableCell>
                            <TableCell className="max-w-[8rem] truncate text-xs">{r.cells.player_b_name || '—'}</TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-[11px]">{previewScoreLabel(r)}</TableCell>
                            <TableCell className="max-w-[7rem] truncate text-xs">{previewWinnerLabel(r)}</TableCell>
                            <TableCell className="text-xs">{rt}</TableCell>
                            <TableCell className="text-xs">{st}</TableCell>
                            <TableCell className="text-xs">
                              <div className="space-y-1">
                                {r.infoMessages?.length ? (
                                  <p className="text-amber-950">{r.infoMessages.join(' · ')}</p>
                                ) : null}
                                {r.messages.length ? (
                                  <p className="text-red-800">{r.messages.join(' · ')}</p>
                                ) : null}
                                {!r.infoMessages?.length && !r.messages.length ? (
                                  <span className="text-slate-500">—</span>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                          )
                        })}
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
              <p className="flex items-center gap-2 text-sm text-red-800">
                <AlertTriangle className="size-4 shrink-0" />
                Corrige las filas en error antes de continuar: no se permite importar con errores críticos.
              </p>
            ) : (
              <p className="text-xs text-slate-600">
                Todas las filas pasaron la validación. El siguiente paso es confirmar y ejecutar la importación por lotes.
              </p>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 text-sm text-amber-950">
              <p className="font-semibold">Confirmar importación</p>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                Se guardarán <strong>{summary.ready}</strong> resultado(s) en base de datos (los partidos ya deben existir
                como cruces RR). La operación usa lotes en el servidor cuando la función Edge está desplegada; si no,
                se aplican secuencialmente con la misma seguridad.
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
                <span className="text-slate-500">Resultados normales</span>
                <span className="font-medium text-slate-900">{summary.normal}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">W.O / DEF</span>
                <span className="font-medium text-slate-900">{summary.wo + summary.def}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">N.R / penalización</span>
                <span className="font-medium text-slate-900">{summary.notReported + summary.doublePenalty}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">Retirados</span>
                <span className="font-medium text-slate-900">{summary.retired}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">Pendientes / histórico convertidos</span>
                <span className="font-medium text-slate-900">{summary.pendingConverted}</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-500">Filas con advertencia</span>
                <span className="font-medium text-slate-900">{summary.warnings + summary.normalized}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-slate-500">Total filas archivo</span>
                <span className="font-medium text-slate-900">{summary.total}</span>
              </li>
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" className="gap-2" onClick={() => setStep(2)}>
                <ArrowLeft className="size-4" />
                Volver a revisión
              </Button>
              <Button
                type="button"
                className="gap-2 bg-[#1F5A4C] hover:bg-[#1F5A4C]/90"
                disabled={!userId || summary.ready === 0 || summary.error > 0}
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
                <p className="mt-4 text-base font-semibold text-slate-900">Importando resultados…</p>
                {importProgress ? (
                  <p className="mt-2 text-sm font-medium tabular-nums text-[#1F5A4C]">
                    Importando {importProgress.done} / {importProgress.total} resultados listos…
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Sincronizando torneo y preparando lotes…</p>
                )}
                <p className="mt-2 text-xs text-slate-500">No cierres esta ventana hasta que termine el proceso.</p>
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
                <span className="text-lg font-semibold text-slate-900">Importación completada</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">ID de lote: {result.batchId.slice(0, 8)}…</p>
              {result.appliedViaEdge === false ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                  La importación por lotes no estuvo disponible; los resultados se aplicaron de forma segura fila a fila
                  (puede tardar más). Despliega la función Edge <span className="font-mono">admin-import-results</span>{' '}
                  para acelerar cargas grandes.
                </p>
              ) : result.appliedViaEdge === true ? (
                <p className="mt-2 text-xs text-emerald-800">
                  Importación por lotes completada en servidor (Edge).
                </p>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-slate-800">{importSnapshotRef.current?.totalFileRows ?? result.rowDetails.length}</p>
                  <p className="text-xs font-medium text-slate-500">Filas del archivo</p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-emerald-700">{result.success}</p>
                  <p className="text-xs font-medium text-slate-500">Guardados correctamente</p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-sky-800">{result.roundRobinInserted}</p>
                  <p className="text-xs font-medium text-slate-500">Cruces RR nuevos (esta pasada)</p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-2xl font-bold tabular-nums text-red-600">{result.errors}</p>
                  <p className="text-xs font-medium text-slate-500">Errores / omitidos</p>
                </div>
              </div>
              {(importSnapshotRef.current?.readyWithNotes ?? 0) > 0 || (importSnapshotRef.current?.pendingConverted ?? 0) > 0 ? (
                <ul className="mt-4 list-inside list-disc space-y-1 text-xs text-slate-600">
                  {(importSnapshotRef.current?.readyWithNotes ?? 0) > 0 ? (
                    <li>
                      {importSnapshotRef.current!.readyWithNotes} fila(s) importadas con advertencias o normalizaciones
                      revisadas en el paso anterior.
                    </li>
                  ) : null}
                  {(importSnapshotRef.current?.pendingConverted ?? 0) > 0 ? (
                    <li>
                      {importSnapshotRef.current!.pendingConverted} fila(s) con indicadores de histórico / pendiente
                      (p. ej. N.R o pending_score tratados según reglas).
                    </li>
                  ) : null}
                </ul>
              ) : null}
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
                Descargar reporte de importación
              </Button>
              <Link
                to="/admin/matches"
                className={buttonVariants({ variant: 'outline', size: 'sm', className: 'inline-flex h-8 items-center gap-2 px-3' })}
              >
                Ver resultados
              </Link>
              <Link
                to="/dashboard"
                className={buttonVariants({ variant: 'outline', size: 'sm', className: 'inline-flex h-8 items-center gap-2 px-3' })}
              >
                Ver leaderboard
              </Link>
            </div>

            <Button type="button" variant="ghost" className="text-slate-600" onClick={resetAll}>
              Cargar otro archivo
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { MatchResultsImportWizard as ResultImportWizard }
