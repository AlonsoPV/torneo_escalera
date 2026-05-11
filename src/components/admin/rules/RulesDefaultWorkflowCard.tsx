import { useFormContext } from 'react-hook-form'

import type { TournamentRulesFormValues } from '@/domain/tournamentRulesForm'

import { FieldErrorText, FieldHint, RulesSectionCard, SwitchRow } from './rulesUi'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RulesDefaultWorkflowCard() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<TournamentRulesFormValues>()

  const defaultsEnabled = watch('defaults_enabled')

  return (
    <RulesSectionCard
      id="card-rules-defaults"
      title="Reglas de default"
      description="Define cómo se manejan los partidos no disputados o reportados como default (W/O)."
    >
      <SwitchRow
        id="rules-defaults-enabled"
        label="Defaults habilitados"
        description="Si está desactivado, el resto de opciones de default quedan sin efecto operativo."
        checked={watch('defaults_enabled')}
        onCheckedChange={(v) => setValue('defaults_enabled', v, { shouldDirty: true, shouldValidate: true })}
      />
      <SwitchRow
        id="rules-default-admin-review"
        label="Requiere revisión del admin"
        description="Los defaults o marcadores sensibles pasan por confirmación del staff."
        checked={watch('default_requires_admin_review')}
        onCheckedChange={(v) => setValue('default_requires_admin_review', v, { shouldDirty: true })}
        disabled={!defaultsEnabled}
      />
      <SwitchRow
        id="rules-player-report-default"
        label="El jugador puede reportar default"
        description="Permite que participantes indiquen ausencia del rival según tu reglamento."
        checked={watch('player_can_report_default')}
        onCheckedChange={(v) => setValue('player_can_report_default', v, { shouldDirty: true })}
        disabled={!defaultsEnabled}
      />
      <SwitchRow
        id="rules-admin-manual-default"
        label="Default manual por admin"
        description="El staff puede registrar un default sin pasar por el flujo del jugador."
        checked={watch('admin_can_set_default_manual')}
        onCheckedChange={(v) => setValue('admin_can_set_default_manual', v, { shouldDirty: true })}
        disabled={!defaultsEnabled}
      />
      <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:p-4">
        <Label htmlFor="rules-result-window-hours" className="text-sm font-medium text-slate-800">
          Ventana para capturar resultado (horas)
        </Label>
        <FieldHint>Referencia operativa futura. En el MVP actual la captura no depende de horario.</FieldHint>
        <Input
          id="rules-result-window-hours"
          type="number"
          inputMode="numeric"
          className="h-10 max-w-[8rem] tabular-nums"
          disabled={!defaultsEnabled}
          {...register('result_submission_window_hours', { valueAsNumber: true })}
        />
        <FieldErrorText error={errors.result_submission_window_hours} />
      </div>
      <SwitchRow
        id="rules-auto-penalty"
        label="Penalización automática por no-show"
        description="Activa sanciones automáticas cuando aplique tu política interna (MVP: preferencia guardada)."
        checked={watch('auto_penalty_no_show')}
        onCheckedChange={(v) => setValue('auto_penalty_no_show', v, { shouldDirty: true })}
        disabled={!defaultsEnabled}
      />
    </RulesSectionCard>
  )
}
