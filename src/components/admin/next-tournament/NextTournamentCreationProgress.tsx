import {
  AlertCircle,
  Check,
  Circle,
  Loader2,
  type LucideIcon,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type {
  GroupPersistStatus,
  NextTournamentCreationStepKey,
  NextTournamentProgressSnapshot,
} from '@/services/nextTournamentFromPrevious'

export const GROUP_STATUS_LABEL_ES: Record<GroupPersistStatus, string> = {
  pending: 'Pendiente',
  saving_group: 'Guardando grupo',
  group_saved: 'Grupo guardado',
  assigning_players: 'Asignando jugadores',
  players_assigned: 'Jugadores asignados',
  generating_matches: 'Generando partidos',
  matches_generated: 'Partidos generados',
  incomplete: 'Incompleto',
  error: 'Error',
}

export type NextTournamentGroupProgressRow = {
  tempId: string
  name: string
  categoryName: string
  status: GroupPersistStatus
  playersTotal: number
  playersAssigned?: number
  matchesInserted?: number
  matchesEstimated?: number
  errorMessage?: string
  isComplete: boolean
}

const PIPELINE_STEPS: {
  key: NextTournamentCreationStepKey
  label: string
}[] = [
  { key: 'creating_tournament', label: 'Creando torneo' },
  { key: 'copying_rules', label: 'Copiando reglas' },
  { key: 'saving_groups', label: 'Guardando grupos' },
  { key: 'assigning_players', label: 'Asignando jugadores' },
  { key: 'generating_matches', label: 'Generando partidos' },
  { key: 'saving_movements', label: 'Guardando movimientos' },
  { key: 'finished', label: 'Finalizado' },
]

function stepRank(s: NextTournamentCreationStepKey): number {
  const i = PIPELINE_STEPS.findIndex((x) => x.key === s)
  return i >= 0 ? i : 0
}

function StepIcon({
  state,
  icon: Icon,
}: {
  state: 'pending' | 'active' | 'done' | 'error'
  icon: LucideIcon
}) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs transition-colors',
        state === 'pending' && 'border-slate-200 bg-white text-slate-400',
        state === 'active' && 'border-[#1F5A4C] bg-[#1F5A4C]/10 text-[#1F5A4C]',
        state === 'done' && 'border-emerald-500 bg-emerald-50 text-emerald-700',
        state === 'error' && 'border-red-400 bg-red-50 text-red-700',
      )}
    >
      <Icon className={cn('size-4', state === 'active' && 'animate-spin')} strokeWidth={2.25} />
    </span>
  )
}

function groupRowBadgeClass(status: GroupPersistStatus): string {
  switch (status) {
    case 'matches_generated':
    case 'players_assigned':
    case 'group_saved':
      return 'bg-emerald-50 text-emerald-900 ring-emerald-200'
    case 'generating_matches':
    case 'assigning_players':
    case 'saving_group':
      return 'bg-sky-50 text-sky-900 ring-sky-200'
    case 'incomplete':
      return 'bg-amber-50 text-amber-950 ring-amber-200'
    case 'error':
      return 'bg-red-50 text-red-900 ring-red-200'
    default:
      return 'bg-slate-50 text-slate-700 ring-slate-200'
  }
}

export function NextTournamentCreationProgress({
  currentStep,
  progress,
  groupRows,
}: {
  currentStep: NextTournamentCreationStepKey | 'idle'
  progress: NextTournamentProgressSnapshot
  groupRows: NextTournamentGroupProgressRow[]
}) {
  const activeRank = currentStep === 'idle' ? -1 : stepRank(currentStep)

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg text-[#102A43]">Creando nuevo torneo</CardTitle>
        <CardDescription className="text-pretty">
          Los datos se están guardando en Supabase. Puedes seguir el avance por pasos y por cada grupo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-[#102A43]">{progress.label}</p>
            <p className="text-sm tabular-nums font-semibold text-[#1F5A4C]">{Math.round(progress.fraction)}%</p>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={Math.round(progress.fraction)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1F5A4C] via-emerald-600 to-teal-500 transition-[width] duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress.fraction))}%` }}
            />
          </div>
        </div>

        <ul className="space-y-0.5 text-sm">
          <li className="flex flex-wrap gap-x-3 gap-y-1 text-slate-600">
            <span className="font-medium text-[#102A43]">Resumen</span>
            <span>
              {progress.groupsSaved} de {progress.groupsTotal} grupos guardados
            </span>
            <span aria-hidden>·</span>
            <span>
              {progress.playersAssigned} de {progress.playersTotal} jugadores asignados
            </span>
            <span aria-hidden>·</span>
            <span>{progress.matchesGenerated} partidos generados</span>
          </li>
        </ul>

        <ol className="space-y-3">
          {PIPELINE_STEPS.map(({ key, label }, idx) => {
            const rank = stepRank(key)
            let state: 'pending' | 'active' | 'done' | 'error' = 'pending'
            if (currentStep === 'finished') {
              state = 'done'
            } else if (activeRank < 0) {
              state = 'pending'
            } else if (rank < activeRank) {
              state = 'done'
            } else if (rank === activeRank) {
              state = 'active'
            } else {
              state = 'pending'
            }

            const Icon: LucideIcon = state === 'done' ? Check : state === 'active' ? Loader2 : Circle

            return (
              <li key={key} className="flex items-start gap-3">
                <StepIcon state={state} icon={Icon} />
                <div className="min-w-0 pt-1">
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      state === 'active' && 'text-[#102A43]',
                      state === 'done' && 'text-emerald-800',
                      state === 'pending' && 'text-slate-500',
                    )}
                  >
                    {idx + 1}. {label}
                  </p>
                  {state === 'active' && Icon === Loader2 ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                      <Loader2 className="size-3.5 animate-spin text-[#1F5A4C]" />
                      En proceso…
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>

        {groupRows.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grupos</p>
            <ul className="max-h-[min(24rem,45vh)] space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-2">
              {groupRows.map((g, i) => (
                <li
                  key={g.tempId}
                  className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-[#102A43]">
                        Grupo {i + 1} · {g.name}
                      </p>
                      <p className="text-xs text-slate-500">{g.categoryName}</p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1',
                        groupRowBadgeClass(g.status),
                      )}
                    >
                      {GROUP_STATUS_LABEL_ES[g.status]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">
                    {g.status === 'saving_group' || g.status === 'pending' ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin text-[#1F5A4C]" />
                        Guardando grupo…
                      </span>
                    ) : null}
                    {g.status === 'assigning_players' ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin text-sky-600" />
                        Asignando jugadores…
                      </span>
                    ) : null}
                    {g.status === 'generating_matches' ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin text-sky-600" />
                        Generando partidos…
                      </span>
                    ) : null}
                    {g.status === 'players_assigned' &&
                    g.playersAssigned != null &&
                    g.playersTotal != null ? (
                      <span>
                        Jugadores asignados {g.playersAssigned}/{g.playersTotal}
                      </span>
                    ) : null}
                    {g.status === 'matches_generated' &&
                    g.matchesInserted != null &&
                    g.matchesEstimated != null ? (
                      <span>
                        Partidos generados {g.matchesInserted}/{g.matchesEstimated}
                      </span>
                    ) : null}
                    {g.status === 'incomplete' &&
                    g.playersAssigned != null &&
                    g.playersTotal != null ? (
                      <span>
                        {g.playersAssigned}/{g.playersTotal} jugadores (grupo incompleto)
                      </span>
                    ) : null}
                    {g.status === 'error' && g.errorMessage ? (
                      <span className="flex items-start gap-1 text-red-800">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                        {g.errorMessage}
                      </span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
