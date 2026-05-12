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
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { tournamentMovementShortLabelEs } from '@/lib/tournamentMovementLabels'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
  createNextTournamentWithProgress,
  validateNextTournamentCreationPlan,
  type CreateNextTournamentWithProgressResult,
  type GroupPersistStatus,
  type NextTournamentCreationStepKey,
  type NextTournamentProgressSnapshot,
  type PromotionPreviewRow,
} from '@/services/nextTournamentFromPrevious'
import { listTournaments } from '@/services/tournaments'
import { useAuthStore } from '@/stores/authStore'
import type { TournamentMovementType, TournamentStatus } from '@/types/database'

const WIZARD_STEPS = [
  { id: 1, label: 'Torneo base', short: '1' },
  { id: 2, label: 'Criterios', short: '2' },
  { id: 3, label: 'Reglas 1–5', short: '3' },
  { id: 4, label: 'Vista previa', short: '4' },
  { id: 5, label: 'Nuevo torneo', short: '5' },
  { id: 6, label: 'Confirmar', short: '6' },
] as const

const GROUP_SIZE = 5 as const

type PreviewFilter = 'all' | 'up' | 'stay' | 'down'

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

function movementTone(type: TournamentMovementType): string {
  switch (type) {
    case 'promote':
    case 'capped_top':
      return 'text-emerald-800 bg-emerald-50 ring-emerald-200'
    case 'stay':
      return 'text-slate-800 bg-slate-50 ring-slate-200'
    case 'demote':
    case 'capped_bottom':
      return 'text-amber-900 bg-amber-50 ring-amber-200'
    default:
      return 'text-slate-700 bg-slate-50 ring-slate-200'
  }
}

function filterRows(rows: PromotionPreviewRow[], f: PreviewFilter, categoryId: string | 'all'): PromotionPreviewRow[] {
  let out = rows
  if (categoryId !== 'all') {
    out = out.filter((r) => r.fromCategoryId === categoryId)
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
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all')
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

  const previewQ = useQuery({
    queryKey: ['nextTournamentPreview', baseId],
    queryFn: () => (baseId ? buildPromotionPreview(baseId) : null),
    enabled: Boolean(baseId),
  })

  const previewRows = previewQ.data?.rows ?? []
  const baseTournament = useMemo(
    () => tournamentsQ.data?.find((t) => t.id === baseId) ?? null,
    [tournamentsQ.data, baseId],
  )

  const filteredPreview = useMemo(
    () => filterRows(previewRows, previewFilter, categoryFilter),
    [previewRows, previewFilter, categoryFilter],
  )

  const groupPlan = useMemo(
    () => (previewRows.length ? buildNextTournamentGroupPreview(previewRows, GROUP_SIZE) : []),
    [previewRows],
  )

  const creationSummary = useMemo(
    () => computeNextTournamentCreationSummary(groupPlan, previewRows.length, GROUP_SIZE),
    [groupPlan, previewRows.length],
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
  const noCat = previewQ.data?.groupsWithoutCategory ?? 0
  const dupSkips = previewQ.data?.skippedDuplicatePlayers ?? 0

  const canLeaveStep1 = Boolean(
    baseId && !previewQ.isLoading && !previewQ.isError && previewRows.length > 0,
  )
  const canGoStep6 = newName.trim().length > 0

  const stepAdvanceGuard = (target: number): boolean => {
    if (target === 2 && !canLeaveStep1) {
      toast.error('Elige un torneo base con jugadores en grupos con categoría.')
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
      <NextTournamentSuccessSummary
        result={creationDone}
        onCreateAnother={() => {
          setCreationDone(null)
          setStep(1)
          setBaseId(null)
          setNewName('')
          setPeriodLabel('')
          setPreviewFilter('all')
          setCategoryFilter('all')
          setCreationFailureMessage(null)
          setCreationGroupRows([])
          setCreationStep('idle')
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <WizardStepper currentStep={step} maxReachable={maxReachable} />

      {step === 1 ? (
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]">1. Torneo base</CardTitle>
            <CardDescription className="text-pretty">
              Se usarán los resultados por grupo (partidos cerrados) para ordenar posiciones y proponer ascensos y
              descensos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Torneo de origen</Label>
              <Select
                value={baseId ?? ''}
                onValueChange={(v) => setBaseId(v || null)}
              >
                <SelectTrigger className="max-w-lg">
                  <SelectValue placeholder="Selecciona un torneo" />
                </SelectTrigger>
                <SelectContent>
                  {(tournamentsQ.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id} label={`${t.name} (${t.status})`}>
                      {t.name} ({t.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {previewQ.isLoading && baseId ? (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="size-4 animate-spin" />
                Analizando grupos…
              </p>
            ) : null}
            {previewQ.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {previewQ.error instanceof Error ? previewQ.error.message : 'Error al cargar el torneo'}
              </div>
            ) : null}
            {previewQ.data ? (
              <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-3 text-sm text-amber-950">
                {nonClosed > 0 ? (
                  <p className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    Hay {nonClosed} partido(s) que no están cerrados o cancelados. El ranking de ascenso solo cuenta
                    partidos cerrados (igual que la clasificación general).
                  </p>
                ) : (
                  <p className="flex gap-2 text-emerald-900">
                    <Check className="mt-0.5 size-4 shrink-0" />
                    Todos los partidos están cerrados o cancelados (para la métrica de este paso).
                  </p>
                )}
                {noCat > 0 ? (
                  <p className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {noCat} grupo(s) con jugadores sin categoría asignada; se omiten del reparto.
                  </p>
                ) : null}
                {dupSkips > 0 ? (
                  <p className="flex gap-2">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    {dupSkips} fila(s) omitida(s): el mismo jugador aparecía en más de un grupo; se conservó la
                    primera clasificación encontrada.
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]">2. Criterio de orden (ascenso / descenso)</CardTitle>
            <CardDescription className="text-pretty">
              Este orden es solo para el wizard «siguiente torneo». La clasificación visible en el torneo puede seguir
              usando otros desempates (sets, enfrentamiento directo, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-slate-700">
            <ol className="list-decimal space-y-2 pl-4">
              <li>Puntos (más es mejor)</li>
              <li>Games a favor</li>
              <li>Diferencia de games (a favor menos en contra)</li>
              <li>Partidos ganados (desempate adicional)</li>
              <li>Nombre (estable alfabéticamente)</li>
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]">3. Reglas por posición en el grupo (5 jugadores)</CardTitle>
            <CardDescription>Se aplican solo a las posiciones existentes (grupos más pequeños: sin pos. 4–5).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className={cn('rounded-xl border p-3 ring-1', movementTone('promote'))}>
                <p className="font-semibold">Pos. 1 y 2</p>
                <p className="text-xs opacity-90">Suben un nivel de división (menor order_index).</p>
              </div>
              <div className={cn('rounded-xl border p-3 ring-1', movementTone('stay'))}>
                <p className="font-semibold">Pos. 3</p>
                <p className="text-xs opacity-90">Se mantiene en la misma división.</p>
              </div>
              <div className={cn('rounded-xl border p-3 ring-1', movementTone('demote'))}>
                <p className="font-semibold">Pos. 4 y 5</p>
                <p className="text-xs opacity-90">Bajan un nivel de división (mayor order_index).</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Si ya estás en la división más alta o más baja del torneo, el movimiento se marca como tope (sin salir de
              esa categoría).
            </p>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]">4. Vista previa de movimientos</CardTitle>
            <CardDescription>
              {filteredPreview.length} de {previewRows.length} jugador(es){' '}
              {baseTournament ? `· Origen: ${baseTournament.name}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Select
                value={previewFilter}
                onValueChange={(v) => setPreviewFilter(v as PreviewFilter)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="up">Suben / tope arriba</SelectItem>
                  <SelectItem value="stay">Se mantienen</SelectItem>
                  <SelectItem value="down">Bajan / tope abajo</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v as string | 'all')}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Categoría origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {(previewQ.data?.categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="h-[min(28rem,55vh)] rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jugador</TableHead>
                    <TableHead className="whitespace-nowrap">Grupo</TableHead>
                    <TableHead className="text-center">Pos</TableHead>
                    <TableHead className="text-center">Pts</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Movimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPreview.map((r) => (
                    <TableRow key={`${r.userId}-${r.fromGroupId}`}>
                      <TableCell className="font-medium text-[#102A43]">{r.displayName}</TableCell>
                      <TableCell className="text-xs text-slate-600">{r.fromGroupName}</TableCell>
                      <TableCell className="text-center">{r.fromPosition}</TableCell>
                      <TableCell className="text-center">{r.points}</TableCell>
                      <TableCell className="text-xs">{r.targetCategoryName}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                            movementTone(r.movementType),
                          )}
                        >
                          {tournamentMovementShortLabelEs(r.movementType)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}

      {step === 5 ? (
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]">5. Datos del nuevo torneo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="next-t-name">Nombre</Label>
              <Input
                id="next-t-name"
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
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="Mayo 2026"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Estado inicial</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as TournamentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="copy-rules"
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
        <NextTournamentCreationProgress
          currentStep={creationStep}
          progress={creationProgress}
          groupRows={creationGroupRows}
        />
      ) : null}

      {step === 6 && creationPhase !== 'running' ? (
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#102A43]">6. Grupos generados</CardTitle>
            <CardDescription className="text-pretty">
              Vista previa según categoría de destino y orden de clasificación. Al confirmar, los grupos y jugadores se
              guardan en la base de datos (no es solo vista previa).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
              <p className="font-medium text-[#102A43]">{newName.trim()}</p>
              {periodLabel.trim() ? <p className="text-xs text-slate-600">Periodo: {periodLabel.trim()}</p> : null}
              <p className="text-xs text-slate-600">
                {copyRules ? 'Se copiarán las reglas del torneo base.' : 'Reglas por defecto del producto.'}
              </p>
            </div>

            <div className="rounded-xl border border-[#1F5A4C]/20 bg-[#1F5A4C]/5 px-3 py-3 text-sm text-[#102A43]">
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

            {creationFailureMessage && creationPhase === 'failed' ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {creationFailureMessage}
              </div>
            ) : null}

            {groupPlan.map((c) => (
              <div key={c.targetSourceCategoryId} className="space-y-2">
                <p className="text-sm font-semibold text-[#102A43]">{c.categoryName}</p>
                <ul className="space-y-2">
                  {c.groups.map((g, gi) => (
                    <li
                      key={`${c.targetSourceCategoryId}-${gi}-${g.name}`}
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
              type="button"
              className="w-full sm:w-auto bg-[#1F5A4C] hover:bg-[#1F5A4C]/90"
              disabled={creationPhase === 'running' || creationPhase === 'validating'}
              onClick={() => void runCreateNextTournament()}
            >
              {creationPhase === 'validating' ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Validando…
                </>
              ) : creationPhase === 'running' ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                'Crear nuevo torneo'
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
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
            type="button"
            className="bg-[#1F5A4C] hover:bg-[#1F5A4C]/90"
            disabled={
              (step === 1 && !canLeaveStep1) ||
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
