import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Info,
  Loader2,
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { tournamentMovementPreviewLabelEs } from '@/lib/tournamentMovementLabels'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  NextTournamentCreationProgress,
  type NextTournamentGroupProgressRow,
} from '@/components/admin/next-tournament/NextTournamentCreationProgress'
import { NextTournamentSuccessSummary } from '@/components/admin/next-tournament/NextTournamentSuccessSummary'
import {
  buildGroupProgressSkeleton,
  buildNextTournamentGroupPreview,
  buildPromotionPreview,
  computeNextTournamentCreationSummary,
  computeNextTournamentGroupSizeWarnings,
  createNextTournamentWithProgress,
  validateNextTournamentCreationPlan,
  type CreateNextTournamentWithProgressResult,
  type GroupPersistStatus,
  type NextTournamentCreationStepKey,
  type NextTournamentProgressSnapshot,
  type PromotionPreviewRow,
} from '@/services/nextTournamentFromPrevious'
import { getTournamentClosureBlockers } from '@/services/tournamentClosure'
import { listTournaments } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { TournamentMovementType, TournamentStatus } from '@/types/database'

const WIZARD_STEPS = [
  { id: 1, label: 'Torneo base', short: '1' },
  { id: 2, label: 'Validar cierre', short: '2' },
  { id: 3, label: 'Rankings finales', short: '3' },
  { id: 4, label: 'Vista previa', short: '4' },
  { id: 5, label: 'Nuevo torneo', short: '5' },
  { id: 6, label: 'Confirmar', short: '6' },
] as const

const GROUP_SIZE = 5 as const

type PreviewFilter = 'all' | 'up' | 'stay' | 'down'

function WizardStepper({ currentStep, maxReachable }: { currentStep: number; maxReachable: number }) {
  const pct = Math.min(100, Math.max(0, ((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100))
  return (
    <div id="admin-next-tournament-stepper" data-name="next-tournament-stepper" className="space-y-3">
      <div className="flex flex-wrap items-center justify-center gap-0.5 sm:justify-between sm:gap-1">
        {WIZARD_STEPS.map((s, i) => {
          const done = currentStep > s.id
          const active = currentStep === s.id
          const locked = s.id > maxReachable && !done
          return (
            <Fragment key={s.id}>
              <div
                id={`admin-next-tournament-step-indicator-${s.id}`}
                data-name={`wizard-step-indicator-${s.id}`}
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
        id="admin-next-tournament-progress"
        data-name="next-tournament-progress-bar"
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
      <p id="admin-next-tournament-step-caption" data-name="wizard-step-caption" className="text-center text-[11px] text-slate-500">
        Paso {currentStep} de {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep - 1]?.label}
      </p>
    </div>
  )
}

function movementTone(type: TournamentMovementType): string {
  switch (type) {
    case 'promote':
      return 'text-emerald-900 bg-emerald-50 ring-emerald-200'
    case 'stay':
      return 'text-sky-900 bg-sky-50 ring-sky-200'
    case 'demote':
      return 'text-red-900 bg-red-50 ring-red-200'
    case 'capped_top':
      return 'text-amber-950 bg-amber-100 ring-amber-300'
    case 'capped_bottom':
      return 'text-slate-700 bg-slate-100 ring-slate-300'
    default:
      return 'text-slate-700 bg-slate-50 ring-slate-200'
  }
}

function filterRows(rows: PromotionPreviewRow[], f: PreviewFilter, fromGroupId: string | 'all'): PromotionPreviewRow[] {
  let out = rows
  if (fromGroupId !== 'all') {
    out = out.filter((r) => r.fromGroupId === fromGroupId)
  }
  if (f === 'all') return out
  if (f === 'up') {
    return out.filter((r) => r.movementType === 'promote' || r.movementType === 'capped_top')
  }
  if (f === 'stay') return out.filter((r) => r.movementType === 'stay')
  return out.filter((r) => r.movementType === 'demote' || r.movementType === 'capped_bottom')
}

export function NextTournamentWizard() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id) ?? ''
  const [searchParams] = useSearchParams()
  const fromParam = searchParams.get('from')

  const [step, setStep] = useState(1)
  const [baseId, setBaseId] = useState<string | null>(fromParam || null)
  const [newName, setNewName] = useState('')
  const [periodLabel, setPeriodLabel] = useState('')
  const [newStatus, setNewStatus] = useState<TournamentStatus>('draft')
  const [copyRules, setCopyRules] = useState(true)
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all')
  const [groupFilterFromId, setGroupFilterFromId] = useState<string | 'all'>('all')
  const [creationDone, setCreationDone] = useState<CreateNextTournamentWithProgressResult | null>(null)
  const [creationPhase, setCreationPhase] = useState<'idle' | 'validating' | 'running' | 'failed'>('idle')
  const [creationStep, setCreationStep] = useState<NextTournamentCreationStepKey | 'idle'>('idle')
  const [creationProgress, setCreationProgress] = useState<NextTournamentProgressSnapshot>(() => ({
    fraction: 0,
    label: 'Preparando…',
    groupsSaved: 0,
    groupsTotal: 0,
    playersAssigned: 0,
    playersTotal: 0,
    matchesGenerated: 0,
  }))
  const [creationGroupRows, setCreationGroupRows] = useState<NextTournamentGroupProgressRow[]>([])
  const [creationFailureMessage, setCreationFailureMessage] = useState<string | null>(null)

  useEffect(() => {
    if (fromParam) setBaseId(fromParam)
  }, [fromParam])

  const tournamentsQ = useQuery({
    queryKey: ['tournaments'],
    queryFn: listTournaments,
  })

  useEffect(() => {
    if (!baseId || !tournamentsQ.data) return
    const sel = tournamentsQ.data.find((t) => t.id === baseId)
    if (sel && sel.status !== 'finished') {
      toast.error('Primero debes cerrar el torneo anterior para crear el siguiente.')
      setBaseId(null)
    }
  }, [baseId, tournamentsQ.data])

  const previewQ = useQuery({
    queryKey: ['nextTournamentPreview', baseId],
    queryFn: () => (baseId ? buildPromotionPreview(baseId) : null),
    enabled: Boolean(baseId),
  })

  const closureQ = useQuery({
    queryKey: ['tournamentClosureBlockers', baseId],
    queryFn: () => getTournamentClosureBlockers(baseId!),
    enabled: Boolean(baseId),
  })

  const previewRows = previewQ.data?.rows ?? []
  const baseTournament = useMemo(
    () => tournamentsQ.data?.find((t) => t.id === baseId) ?? null,
    [tournamentsQ.data, baseId],
  )

  const finishedTournaments = useMemo(
    () => (tournamentsQ.data ?? []).filter((t) => t.status === 'finished'),
    [tournamentsQ.data],
  )

  const filteredPreview = useMemo(
    () => filterRows(previewRows, previewFilter, groupFilterFromId),
    [previewRows, previewFilter, groupFilterFromId],
  )

  const originGroupsOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of previewRows) {
      if (!m.has(r.fromGroupId)) m.set(r.fromGroupId, r.fromGroupName)
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [previewRows])

  const groupPlan = useMemo(
    () =>
      previewRows.length && previewQ.data?.sortedDistinctGroupOrderIndices
        ? buildNextTournamentGroupPreview(
            previewRows,
            GROUP_SIZE,
            previewQ.data.sortedDistinctGroupOrderIndices,
          )
        : [],
    [previewRows, previewQ.data?.sortedDistinctGroupOrderIndices],
  )

  const creationSummary = useMemo(
    () => computeNextTournamentCreationSummary(groupPlan, previewRows.length, GROUP_SIZE),
    [groupPlan, previewRows.length],
  )

  const standingsByGroup = useMemo(() => {
    const m = new Map<string, { name: string; orderIndex: number; rows: PromotionPreviewRow[] }>()
    for (const r of previewRows) {
      const cur = m.get(r.fromGroupId) ?? {
        name: r.fromGroupName,
        orderIndex: r.fromGroupOrderIndex,
        rows: [],
      }
      cur.rows.push(r)
      m.set(r.fromGroupId, cur)
    }
    for (const v of m.values()) {
      v.rows.sort(
        (a, b) => a.fromPosition - b.fromPosition || a.displayName.localeCompare(b.displayName, 'es'),
      )
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name, 'es'))
  }, [previewRows])

  const groupSizeWarnings = useMemo(
    () => computeNextTournamentGroupSizeWarnings(groupPlan, GROUP_SIZE),
    [groupPlan],
  )

  const invalidateAfterCreation = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['tournaments'] }),
      qc.invalidateQueries({ queryKey: ['admin-tournaments'] }),
      qc.invalidateQueries({ queryKey: ['admin-overview'] }),
      qc.invalidateQueries({ queryKey: ['playerContexts'] }),
      qc.invalidateQueries({ queryKey: ['tournament-dashboard-options'] }),
      qc.invalidateQueries({ queryKey: ['admin-groups'] }),
      qc.invalidateQueries({ queryKey: ['group-categories'] }),
      qc.invalidateQueries({ queryKey: ['admin-matches'] }),
    ])
  }, [qc])

  const runCreateNextTournament = useCallback(async () => {
    if (!baseId || !userId) {
      toast.error('Sesión o torneo base no válidos')
      return
    }

    setCreationFailureMessage(null)
    setCreationPhase('validating')

    const payloadBase = {
      baseTournamentId: baseId,
      name: newName.trim(),
      periodLabel: periodLabel.trim() || null,
      status: newStatus,
      copyRules,
      createdBy: userId,
      groupSize: GROUP_SIZE,
    }

    let validationErrors: string[] = []
    try {
      validationErrors = await validateNextTournamentCreationPlan(payloadBase, previewRows, groupPlan)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al validar los datos'
      console.error('[NextTournamentWizard] validate', err)
      setCreationFailureMessage(msg)
      setCreationPhase('failed')
      toast.error(msg)
      return
    }

    if (validationErrors.length > 0) {
      const first = validationErrors[0]!
      setCreationFailureMessage(first)
      setCreationPhase('failed')
      toast.error(first)
      return
    }

    setCreationPhase('running')
    setCreationStep('idle')
    setCreationProgress({
      fraction: 0,
      label: 'Iniciando…',
      groupsSaved: 0,
      groupsTotal: groupPlan.reduce((a, c) => a + c.groups.length, 0),
      playersAssigned: 0,
      playersTotal: previewRows.length,
      matchesGenerated: 0,
    })
    const skeleton = buildGroupProgressSkeleton(groupPlan)
    setCreationGroupRows(
      skeleton.map((s) => ({
        tempId: s.tempId,
        name: s.name,
        categoryName: s.categoryName,
        status: s.status as GroupPersistStatus,
        playersTotal: s.playersTotal,
        isComplete: s.isComplete,
      })),
    )

    try {
      const result = await createNextTournamentWithProgress(
        {
          ...payloadBase,
          cachedPreview: { rows: previewRows, groupPlan },
        },
        {
          onStepStart: (s) => setCreationStep(s),
          onGroupUpdate: (tempId, status, meta) => {
            setCreationGroupRows((prev) =>
              prev.map((r) =>
                r.tempId !== tempId
                  ? r
                  : {
                      ...r,
                      status,
                      playersAssigned: meta?.playersAssigned ?? r.playersAssigned,
                      playersTotal: meta?.playersTotal ?? r.playersTotal,
                      matchesInserted: meta?.matchesInserted ?? r.matchesInserted,
                      matchesEstimated: meta?.matchesEstimated ?? r.matchesEstimated,
                      errorMessage:
                        status === 'error'
                          ? (meta?.message ?? r.errorMessage)
                          : undefined,
                    }
              )
            )
          },
          onProgressUpdate: (p) => setCreationProgress(p),
        },
      )
      if (result.partialFailure) {
        toast.warning('Torneo creado con incidencias. Revisa el resumen.')
      } else {
        toast.success('Torneo creado correctamente')
      }
      await invalidateAfterCreation()
      setCreationDone(result)
      setCreationPhase('idle')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el torneo'
      console.error('[NextTournamentWizard] create', e)
      setCreationFailureMessage(msg)
      setCreationPhase('failed')
      toast.error(msg)
    }
  }, [
    baseId,
    userId,
    newName,
    periodLabel,
    newStatus,
    copyRules,
    previewRows,
    groupPlan,
    invalidateAfterCreation,
  ])

  const maxReachable = creationDone ? WIZARD_STEPS.length : step
  const nonClosed = previewQ.data?.nonClosedMatchCount ?? 0
  const dupSkips = previewQ.data?.skippedDuplicatePlayers ?? 0
  const baseFinished = baseTournament?.status === 'finished'
  const snapshotRowCount = previewQ.data?.snapshotRowCount ?? 0
  const usedSnapshot = previewQ.data?.usedSnapshot ?? false
  const requiresSnapshot = Boolean(baseTournament?.finished_at)
  const hasSnapshot = snapshotRowCount > 0
  const snapshotOk = !requiresSnapshot || hasSnapshot

  const canLeaveStep1 = Boolean(
    baseId &&
      !previewQ.isLoading &&
      !previewQ.isError &&
      previewRows.length > 0 &&
      baseFinished &&
      nonClosed === 0,
  )

  const canLeaveStep2 = Boolean(
    canLeaveStep1 &&
      !closureQ.isLoading &&
      !closureQ.isError &&
      Boolean(closureQ.data?.canClose) &&
      snapshotOk,
  )

  const canGoStep6 = newName.trim().length > 0

  const stepAdvanceGuard = (target: number): boolean => {
    if (target === 2 && !canLeaveStep1) {
      toast.error(
        'Selecciona un torneo finalizado con jugadores en grupos y todos los partidos cerrados o cancelados.',
      )
      return false
    }
    if (target === 3 && !canLeaveStep2) {
      toast.error(
        'Revisa el checklist de cierre: sin pendientes operativos y snapshot de clasificación si el torneo se cerró con el nuevo flujo.',
      )
      return false
    }
    if (target === 6 && !canGoStep6) {
      toast.error('Indica un nombre para el nuevo torneo.')
      return false
    }
    return true
  }

  if (creationDone) {
    return (
      <div id="admin-next-tournament-result" data-name="next-tournament-success-root">
        <NextTournamentSuccessSummary
          result={creationDone}
          onCreateAnother={() => {
            setCreationDone(null)
            setStep(1)
            setBaseId(null)
            setNewName('')
            setPeriodLabel('')
            setPreviewFilter('all')
            setGroupFilterFromId('all')
            setCreationFailureMessage(null)
            setCreationGroupRows([])
            setCreationStep('idle')
          }}
        />
      </div>
    )
  }

  return (
    <div id="admin-next-tournament-wizard" data-name="next-tournament-wizard-root" className="space-y-6">
      <WizardStepper currentStep={step} maxReachable={maxReachable} />

      {step === 1 ? (
        <Card
          id="admin-next-tournament-card-step-1"
          data-name="next-tournament-step-base-tournament"
          className="rounded-2xl border-slate-200/80 shadow-sm"
        >
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]" id="admin-next-tournament-title-step-1">
              1. Torneo base
            </CardTitle>
            <CardDescription className="text-pretty">
              Solo se listan torneos en estado <span className="font-medium">finished</span>. La jerarquía usa{' '}
              <span className="font-medium">order_index</span> del grupo (menor índice = grupo más alto).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-next-tournament-select-base-tournament">Torneo de origen</Label>
              <Select
                value={baseId ?? ''}
                onValueChange={(v) => setBaseId(v || null)}
              >
                <SelectTrigger id="admin-next-tournament-select-base-tournament" className="min-w-[200px] max-w-[280px] w-auto">
                  <SelectValue placeholder="Selecciona un torneo cerrado">
                    {baseTournament?.name ?? undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {finishedTournaments.length === 0 ? (
                    <div
                      id="admin-next-tournament-select-no-finished"
                      data-name="next-tournament-no-finished-options"
                      className="px-2 py-3 text-sm text-slate-600"
                    >
                      No hay torneos finalizados todavía.
                    </div>
                  ) : (
                    finishedTournaments.map((t) => (
                      <SelectItem
                        key={t.id}
                        data-item-id={`admin-next-tournament-base-option-${t.id}`}
                        value={t.id}
                        label={t.name}
                      >
                        {t.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {finishedTournaments.length === 0 ? (
                <p className="text-xs text-slate-600">
                  <Link
                    id="admin-next-tournament-link-goto-tournaments"
                    data-name="link-goto-admin-tournaments"
                    className="font-medium text-[#1F5A4C] underline underline-offset-2"
                    to="/admin/tournaments"
                  >
                    Ir a Torneos
                  </Link>{' '}
                  para cerrar el torneo actual antes de crear el siguiente.
                </p>
              ) : null}
            </div>
            {previewQ.isLoading && baseId ? (
              <p
                id="admin-next-tournament-preview-loading"
                data-name="next-tournament-preview-loading"
                className="flex items-center gap-2 text-sm text-slate-600"
              >
                <Loader2 className="size-4 animate-spin" />
                Analizando grupos…
              </p>
            ) : null}
            {previewQ.isError ? (
              <div
                id="admin-next-tournament-preview-error"
                data-name="next-tournament-preview-error"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {previewQ.error instanceof Error ? previewQ.error.message : 'Error al cargar el torneo'}
              </div>
            ) : null}
            {previewQ.data ? (
              <div
                id="admin-next-tournament-base-status-panel"
                data-name="next-tournament-base-status"
                className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-3 text-sm text-amber-950"
              >
                {!baseFinished ? (
                  <p className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    El torneo base no está en estado <span className="font-medium">finished</span>. Debes finalizarlo
                    antes de crear el siguiente.
                  </p>
                ) : null}
                {nonClosed > 0 ? (
                  <p className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    Hay {nonClosed} partido(s) que no están cerrados o cancelados. Cierra o cancela todos los partidos
                    antes de continuar.
                  </p>
                ) : baseFinished ? (
                  <p className="flex gap-2 text-emerald-900">
                    <Check className="mt-0.5 size-4 shrink-0" />
                    Torneo finalizado y todos los partidos cerrados o cancelados.
                  </p>
                ) : null}
                {dupSkips > 0 ? (
                  <p className="flex gap-2">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    {dupSkips} fila(s) omitida(s): el mismo jugador aparecía en más de un grupo; se conservó la
                    primera clasificación encontrada.
                  </p>
                ) : null}
                {requiresSnapshot && !hasSnapshot ? (
                  <p className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    Falta el snapshot de clasificación para este torneo. Vuelve a ejecutar{' '}
                    <span className="font-medium">Cerrar torneo</span> en{' '}
                    <Link className="font-medium underline underline-offset-2" to="/admin/tournaments">
                      Administración → Torneos
                    </Link>
                    .
                  </p>
                ) : null}
                {usedSnapshot ? (
                  <p className="flex gap-2 text-sky-950">
                    <Check className="mt-0.5 size-4 shrink-0" />
                    Clasificación congelada desde el cierre ({snapshotRowCount} filas en snapshot).
                  </p>
                ) : baseFinished && !requiresSnapshot ? (
                  <p className="flex gap-2">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    Sin snapshot (torneo antiguo): se usa la clasificación actual de los resultados.
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card
          id="admin-next-tournament-card-step-2"
          data-name="next-tournament-step-validate-close"
          className="rounded-2xl border-slate-200/80 shadow-sm"
        >
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]" id="admin-next-tournament-title-step-2">
              2. Validar cierre
            </CardTitle>
            <CardDescription className="text-pretty">
              Mismas reglas que al cerrar desde Torneos: sin partidos abiertos ni marcadores en revisión, y snapshot de
              clasificación si el torneo tiene fecha de cierre formal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {closureQ.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="size-4 animate-spin" />
                Validando operación…
              </p>
            ) : null}
            {closureQ.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {closureQ.error instanceof Error ? closureQ.error.message : 'Error al validar el cierre'}
              </div>
            ) : null}
            {closureQ.data ? (
              <div
                className={cn(
                  'rounded-xl border px-3 py-3 text-sm',
                  closureQ.data.canClose ? 'border-emerald-200 bg-emerald-50/60 text-emerald-950' : 'border-amber-200 bg-amber-50/80 text-amber-950',
                )}
              >
                <p className="font-semibold">
                  {closureQ.data.canClose ? 'Checklist operativo: OK' : 'No puedes continuar todavía'}
                </p>
                {!closureQ.data.canClose && closureQ.data.messages.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc space-y-1 text-[13px]">
                    {closureQ.data.messages.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ) : null}
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs opacity-90">
                  <dt>Marcador pendiente</dt>
                  <dd className="text-right font-medium">{closureQ.data.counts.pendingScore}</dd>
                  <dt>Esperando rival</dt>
                  <dd className="text-right font-medium">{closureQ.data.counts.scoreSubmitted}</dd>
                  <dt>Disputas</dt>
                  <dd className="text-right font-medium">{closureQ.data.counts.scoreDisputed}</dd>
                  <dt>Validación admin</dt>
                  <dd className="text-right font-medium">{closureQ.data.counts.playerConfirmed}</dd>
                  <dt>Partidos no cerrados</dt>
                  <dd className="text-right font-medium">{closureQ.data.counts.openMatches}</dd>
                </dl>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-800">
              <p className="font-semibold text-[#102A43]">Snapshot de clasificación</p>
              {requiresSnapshot ? (
                hasSnapshot ? (
                  <p className="mt-1 flex items-start gap-2 text-emerald-900">
                    <Check className="mt-0.5 size-4 shrink-0" />
                    Guardado al cerrar ({snapshotRowCount} filas).
                  </p>
                ) : (
                  <p className="mt-1 flex items-start gap-2 text-amber-950">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    Obligatorio para este torneo: ejecuta de nuevo el cierre administrativo.
                  </p>
                )
              ) : (
                <p className="mt-1 flex items-start gap-2 text-slate-700">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  Opcional para torneos finalizados antes del nuevo flujo: se usará la clasificación en vivo.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                id="admin-next-tournament-link-results-pending"
                data-name="link-admin-results"
                to="/admin/results"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'justify-center',
                )}
              >
                Ir a resultados pendientes
              </Link>
              <Link
                id="admin-next-tournament-link-close-tournament-page"
                data-name="link-admin-tournaments-close"
                to="/admin/tournaments"
                className={cn(
                  buttonVariants({ variant: 'default', size: 'sm' }),
                  'justify-center bg-[#1F5A4C] hover:bg-[#1F5A4C]/90',
                )}
              >
                Cerrar torneo
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card
          id="admin-next-tournament-card-step-3"
          data-name="next-tournament-step-rankings"
          className="rounded-2xl border-slate-200/80 shadow-sm"
        >
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]" id="admin-next-tournament-title-step-3">
              3. Rankings finales por grupo
            </CardTitle>
            <CardDescription className="text-pretty">
              Orden: puntos, games a favor, diferencia de games (desempate estable por nombre). Sin usar categorías de
              división.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {standingsByGroup.map((g) => (
              <div id={`admin-next-tournament-ranking-group-${g.id}`} data-name="ranking-group-block" key={g.id} className="space-y-2">
                <p className="text-sm font-semibold text-[#102A43]">
                  {g.name}{' '}
                  <span className="font-normal text-slate-500">
                    (order_index {g.orderIndex}
                    {previewQ.data?.sortedDistinctGroupOrderIndices ? (
                      (() => {
                        const ix = previewQ.data.sortedDistinctGroupOrderIndices.indexOf(g.orderIndex)
                        return ix >= 0 ? ` · Grupo ${ix + 1}` : ''
                      })()
                    ) : (
                      ''
                    )}
                    )
                  </span>
                </p>
                <ScrollArea className="max-h-64 rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Jugador</TableHead>
                        <TableHead className="text-center">Pts</TableHead>
                        <TableHead className="text-center">JF</TableHead>
                        <TableHead className="text-center">Diff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.rows.map((r) => (
                        <TableRow id={`admin-next-tournament-ranking-row-${g.id}-${r.userId}`} key={`${g.id}-${r.userId}`}>
                          <TableCell>{r.fromPosition}</TableCell>
                          <TableCell className="font-medium text-[#102A43]">{r.displayName}</TableCell>
                          <TableCell className="text-center">{r.points}</TableCell>
                          <TableCell className="text-center">{r.gamesFor}</TableCell>
                          <TableCell className="text-center">
                            {r.gamesDifference >= 0 ? `+${r.gamesDifference}` : r.gamesDifference}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {step === 4 ? (
        <Card
          id="admin-next-tournament-card-step-4"
          data-name="next-tournament-step-movement-preview"
          className="rounded-2xl border-slate-200/80 shadow-sm"
        >
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]" id="admin-next-tournament-title-step-4">
              4. Vista previa de movimientos
            </CardTitle>
            <CardDescription>
              Posiciones 1–2 suben un nivel, 3 se queda, 4–5 bajan (con topes). Mostrando {filteredPreview.length} de{' '}
              {previewRows.length} jugador(es)
              {baseTournament ? ` · ${baseTournament.name}` : ''}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Select
                value={previewFilter}
                onValueChange={(v) => setPreviewFilter(v as PreviewFilter)}
              >
                <SelectTrigger id="admin-next-tournament-select-movement-filter" className="min-w-[180px] w-auto max-w-[280px]">
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem data-item-id="admin-next-tournament-filter-all" value="all" label="Todos">
                    Todos
                  </SelectItem>
                  <SelectItem data-item-id="admin-next-tournament-filter-up" value="up" label="Suben / tope arriba">
                    Suben / tope arriba
                  </SelectItem>
                  <SelectItem data-item-id="admin-next-tournament-filter-stay" value="stay" label="Se mantienen">
                    Se mantienen
                  </SelectItem>
                  <SelectItem data-item-id="admin-next-tournament-filter-down" value="down" label="Bajan / tope abajo">
                    Bajan / tope abajo
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={groupFilterFromId}
                onValueChange={(v) => setGroupFilterFromId(v as string | 'all')}
              >
                <SelectTrigger id="admin-next-tournament-select-origin-group" className="min-w-[180px] w-auto max-w-[280px]">
                  <SelectValue placeholder="Grupo origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem data-item-id="admin-next-tournament-filter-group-all" value="all" label="Todos los grupos">
                    Todos los grupos
                  </SelectItem>
                  {originGroupsOptions.map(([gid, label]) => (
                    <SelectItem
                      data-item-id={`admin-next-tournament-filter-group-${gid}`}
                      key={gid}
                      value={gid}
                      label={label}
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="h-[min(28rem,55vh)] rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Grupo actual</TableHead>
                    <TableHead className="text-center">Pos</TableHead>
                    <TableHead>Jugador</TableHead>
                    <TableHead className="text-center">Pts</TableHead>
                    <TableHead className="text-center">JF</TableHead>
                    <TableHead className="text-center">Diff</TableHead>
                    <TableHead>Movimiento</TableHead>
                    <TableHead>Nuevo grupo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPreview.map((r) => {
                    const distinct = previewQ.data?.sortedDistinctGroupOrderIndices ?? []
                    const fromIx = distinct.indexOf(r.fromGroupOrderIndex)
                    const fromLabel =
                      fromIx >= 0 ? `Grupo ${fromIx + 1}` : `Ord.${r.fromGroupOrderIndex}`
                    return (
                      <TableRow id={`admin-next-tournament-preview-row-${r.userId}-${r.fromGroupId}`} key={`${r.userId}-${r.fromGroupId}`}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-700">
                          {fromLabel}
                          <span className="mt-0.5 block text-[10px] font-normal text-slate-500">{r.fromGroupName}</span>
                        </TableCell>
                        <TableCell className="text-center">{r.fromPosition}</TableCell>
                        <TableCell className="font-medium text-[#102A43]">{r.displayName}</TableCell>
                        <TableCell className="text-center">{r.points}</TableCell>
                        <TableCell className="text-center">{r.gamesFor}</TableCell>
                        <TableCell className="text-center">
                          {r.gamesDifference >= 0 ? `+${r.gamesDifference}` : r.gamesDifference}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                              movementTone(r.movementType),
                            )}
                          >
                            {tournamentMovementPreviewLabelEs(r.movementReason, r.movementType)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-[#102A43]">{r.targetGroupLabel}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}

      {step === 5 ? (
        <Card
          id="admin-next-tournament-card-step-5"
          data-name="next-tournament-step-new-config"
          className="rounded-2xl border-slate-200/80 shadow-sm"
        >
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]" id="admin-next-tournament-title-step-5">
              5. Datos del nuevo torneo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="next-t-name">Nombre</Label>
              <Input
                id="next-t-name"
                name="nextTournamentName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Torneo Mayo 2026"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-t-period">Etiqueta de periodo (opcional)</Label>
              <Input
                id="next-t-period"
                name="nextTournamentPeriodLabel"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="Mayo 2026"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-next-tournament-select-initial-status">Estado inicial</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as TournamentStatus)}>
                <SelectTrigger id="admin-next-tournament-select-initial-status" className="min-w-[180px] w-auto">
                  <SelectValue placeholder="Estado inicial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem data-item-id="admin-next-tournament-status-draft" value="draft" label="Borrador">
                    Borrador
                  </SelectItem>
                  <SelectItem data-item-id="admin-next-tournament-status-active" value="active" label="Activo">
                    Activo
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="copy-rules"
                name="nextTournamentCopyRules"
                type="checkbox"
                className="size-4 rounded border-slate-300 accent-[#1F5A4C]"
                checked={copyRules}
                onChange={(e) => setCopyRules(e.target.checked)}
              />
              <Label htmlFor="copy-rules" className="text-sm font-normal">
                Copiar reglas del torneo base
              </Label>
            </div>
            <p className="text-xs text-slate-500">
              Tamaño de grupo fijo: {GROUP_SIZE} jugadores. Los grupos completos generan round robin automáticamente
              al inscribir el último jugador.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {step === 6 && creationPhase === 'running' ? (
        <div id="admin-next-tournament-creation-progress-root" data-name="next-tournament-persist-progress">
          <NextTournamentCreationProgress
            currentStep={creationStep}
            progress={creationProgress}
            groupRows={creationGroupRows}
          />
        </div>
      ) : null}

      {step === 6 && creationPhase !== 'running' ? (
        <Card
          id="admin-next-tournament-card-step-6"
          data-name="next-tournament-step-confirm"
          className="rounded-2xl border-slate-200/80 shadow-sm"
        >
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]" id="admin-next-tournament-title-step-6">
              6. Grupos generados
            </CardTitle>
            <CardDescription className="text-pretty">
              Vista previa por nivel de grupo destino (`order_index`) y orden de clasificación. Al confirmar, los grupos y
              jugadores se guardan en la base de datos (sin división por categorías).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              id="admin-next-tournament-confirm-summary-panel"
              data-name="next-tournament-confirm-recap"
              className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-700"
            >
              <p className="font-medium text-[#102A43]">{newName.trim()}</p>
              {periodLabel.trim() ? <p className="text-xs text-slate-600">Periodo: {periodLabel.trim()}</p> : null}
              <p className="text-xs text-slate-600">
                {copyRules ? 'Se copiarán las reglas del torneo base.' : 'Reglas por defecto del producto.'}
              </p>
            </div>

            <div
              id="admin-next-tournament-confirm-stats"
              data-name="next-tournament-save-summary"
              className="rounded-xl border border-[#1F5A4C]/20 bg-[#1F5A4C]/5 px-3 py-3 text-sm text-[#102A43]"
            >
              <p className="font-semibold">Resumen antes de guardar</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
                <li>Se crearán {creationSummary.totalGroups} grupo(s).</li>
                <li>{creationSummary.completeGroups} grupo(s) completo(s).</li>
                <li>{creationSummary.incompleteGroups} grupo(s) incompleto(s).</li>
                <li>{creationSummary.totalPlayers} jugador(es) en total.</li>
                <li>
                  {creationSummary.estimatedMatches > 0
                    ? `Unos ${creationSummary.estimatedMatches} partido(s) se generarán automáticamente en grupos completos.`
                    : 'No hay grupos completos: no se generarán partidos automáticamente.'}
                </li>
                <li>{creationSummary.movementCount} movimiento(s) se guardarán en el historial.</li>
              </ul>
            </div>

            {groupSizeWarnings.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
                <p className="flex gap-2 font-semibold">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Advertencias de tamaño de grupo
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] leading-snug">
                  {groupSizeWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-900/90">
                  Puedes continuar: después ajusta jugadores manualmente en Administración → Grupos si hace falta.
                </p>
              </div>
            ) : null}

            {creationFailureMessage && creationPhase === 'failed' ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {creationFailureMessage}
              </div>
            ) : null}

            {groupPlan.map((c) => (
              <div id={`admin-next-tournament-plan-tier-${c.targetOrderIndex}`} key={`tier-${c.targetOrderIndex}`} className="space-y-2">
                <p className="text-sm font-semibold text-[#102A43]">{c.tierDisplayName}</p>
                <ul className="space-y-2">
                  {c.groups.map((g, gi) => (
                    <li
                      id={`admin-next-tournament-plan-group-${c.targetOrderIndex}-${gi}`}
                      key={`${c.targetOrderIndex}-${gi}-${g.name}`}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{g.name}</span>
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-wide',
                            g.isComplete ? 'text-emerald-700' : 'text-amber-700',
                          )}
                        >
                          {g.isComplete ? 'Completo (RR)' : 'Incompleto'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{g.players.map((p) => p.displayName).join(' · ')}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Button
              id="admin-next-tournament-btn-submit-create"
              name="submitCreateNextTournament"
              type="button"
              className="w-full sm:w-auto bg-[#1F5A4C] hover:bg-[#1F5A4C]/90"
              disabled={creationPhase === 'validating'}
              onClick={() => void runCreateNextTournament()}
            >
              {creationPhase === 'validating' ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Validando…
                </>
              ) : (
                'Crear nuevo torneo'
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div
        id="admin-next-tournament-wizard-nav"
        data-name="next-tournament-wizard-navigation"
        className="flex flex-wrap justify-between gap-2"
      >
        <Button
          id="admin-next-tournament-btn-back"
          name="wizardBack"
          type="button"
          variant="outline"
          disabled={step <= 1 || creationPhase === 'running' || creationPhase === 'validating'}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          <ArrowLeft className="mr-1 size-4" />
          Atrás
        </Button>
        {step < WIZARD_STEPS.length ? (
          <Button
            id="admin-next-tournament-btn-next"
            name="wizardNext"
            type="button"
            className="bg-[#1F5A4C] hover:bg-[#1F5A4C]/90"
            disabled={
              (step === 1 && !canLeaveStep1) ||
              (step === 2 && !canLeaveStep2) ||
              (step === 5 && !canGoStep6) ||
              creationPhase === 'running' ||
              creationPhase === 'validating'
            }
            onClick={() => {
              const next = step + 1
              if (!stepAdvanceGuard(next)) return
              setStep(next)
            }}
          >
            Siguiente
            <ArrowRight className="ml-1 size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
