import { useFormContext } from 'react-hook-form'

import type { TournamentRulesFormValues } from '@/domain/tournamentRulesForm'

import { Badge } from '@/components/ui/badge'

import { FieldHint, RulesSectionCard, SwitchRow } from './rulesUi'

export function RulesRankingCard() {
  const { watch, setValue, formState } = useFormContext<TournamentRulesFormValues>()
  const criteria = watch('ranking_criteria')
  const errors = formState.errors

  return (
    <RulesSectionCard
      id="card-rules-ranking"
      title="Criterios de clasificación"
      description="Estos criterios se usarán para ordenar jugadores con el mismo puntaje (MVP: preferencia guardada; orden fijo por producto)."
    >
      <FieldHint>Orden de desempate recomendado. Puedes desactivar criterios que no quieras usar en tu torneo.</FieldHint>
      <ol className="mt-3 space-y-2">
        {criteria.map((criterion, index) => (
          <li key={criterion.id} className="rounded-xl border border-slate-100 bg-white px-1 py-1 sm:px-2">
            <SwitchRow
              id={`rules-ranking-${criterion.id}`}
              label={
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {index + 1}
                  </Badge>
                  <span className="text-sm font-medium text-slate-900">{criterion.label}</span>
                </span>
              }
              checked={criterion.enabled}
              onCheckedChange={(v) => {
                const next = criteria.map((c, i) => (i === index ? { ...c, enabled: v } : c))
                setValue('ranking_criteria', next, { shouldDirty: true, shouldValidate: true })
              }}
            />
          </li>
        ))}
      </ol>
      {typeof errors.ranking_criteria === 'object' &&
      errors.ranking_criteria &&
      'message' in errors.ranking_criteria &&
      typeof (errors.ranking_criteria as { message?: unknown }).message === 'string' ? (
        <p className="text-xs font-medium text-red-600">{(errors.ranking_criteria as { message: string }).message}</p>
      ) : null}
      <p className="text-[11px] leading-relaxed text-slate-400">
        El orden de desempate queda guardado para integrarlo con el motor de clasificación.
      </p>
    </RulesSectionCard>
  )
}
