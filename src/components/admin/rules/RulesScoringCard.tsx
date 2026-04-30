import { useFormContext } from 'react-hook-form'

import type { TournamentRulesFormValues } from '@/domain/tournamentRulesForm'

import { FieldErrorText, NumberFieldRow, RulesSectionCard, SwitchRow } from './rulesUi'

export function RulesScoringCard() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<TournamentRulesFormValues>()

  const allowHigh = watch('allowHighDefaultWinPoints')

  return (
    <RulesSectionCard
      id="card-rules-scoring"
      title="Reglas de puntuación"
      description="Define cuántos puntos de ranking otorgan los resultados de partido. Estos valores alimentan la clasificación del grupo."
    >
      <NumberFieldRow
        label="Partido ganado"
        hint="Puntos que recibe el jugador que gana un partido normal."
        inputId="rules-points-per-win"
        inputProps={register('points_per_win', { valueAsNumber: true })}
        error={errors.points_per_win}
      />
      <NumberFieldRow
        label="Partido jugado (derrota normal)"
        hint="Puntos que recibe el jugador que pierde pero disputó el partido (p. ej. 1 pt)."
        inputId="rules-points-per-loss"
        inputProps={register('points_per_loss', { valueAsNumber: true })}
        error={errors.points_per_loss}
      />
      <NumberFieldRow
        label="Victoria por default"
        hint="Puntos que recibe el jugador cuando gana por default (W/O)."
        inputId="rules-points-default-win"
        inputProps={register('points_default_win', { valueAsNumber: true })}
        error={errors.points_default_win}
      />
      <NumberFieldRow
        label="Derrota por default"
        hint="Penalización o puntos para el jugador que pierde por default (puede ser negativa)."
        inputId="rules-points-default-loss"
        inputProps={register('points_default_loss', { valueAsNumber: true })}
        error={errors.points_default_loss}
      />

      <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3 sm:p-4">
        <SwitchRow
          id="rules-allow-high-default-win"
          label="Permitir victoria por default con más puntos que una victoria normal"
          description="Solo activa esto si tu reglamento lo permite explícitamente."
          checked={allowHigh}
          onCheckedChange={(v) => setValue('allowHighDefaultWinPoints', v, { shouldValidate: true, shouldDirty: true })}
        />
        <FieldErrorText error={errors.allowHighDefaultWinPoints} />
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Por defecto exigimos que la victoria por default no supere los puntos de una victoria normal, para evitar incentivos raros en la
          tabla.
        </p>
      </div>
    </RulesSectionCard>
  )
}
