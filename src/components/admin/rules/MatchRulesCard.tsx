import { useFormContext } from 'react-hook-form'

import type { FinalSetFormatId, MatchFormatId, SetTypeId, TournamentRulesFormValues } from '@/domain/tournamentRulesForm'
import {
  FINAL_SET_LABEL,
  MATCH_FORMAT_LABEL,
  SET_TYPE_LABEL,
  suddenDeathLabel,
  tiebreakAtLabel,
} from '@/lib/matchRulesLabels'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { FieldHint, RulesSectionCard, SwitchRow } from './rulesUi'

const matchFormatOrder: MatchFormatId[] = ['one_set', 'best_of_3', 'best_of_5']
const setTypeOrder: SetTypeId[] = ['long_set', 'short_set', 'tiebreak_set', 'pro_set']
const finalSetOrder: FinalSetFormatId[] = ['full_set', 'sudden_death', 'super_tiebreak', 'none']

export function MatchRulesCard() {
  const { watch, setValue, formState } = useFormContext<TournamentRulesFormValues>()
  const matchFormat = watch('match_format')
  const setType = watch('set_type')
  const gamesPerSet = watch('games_per_set')
  const minDiff = watch('min_game_difference')
  const tiebreakAt = watch('tiebreak_at')
  const finalFmt = watch('final_set_format')
  const suddenPts = watch('sudden_death_points')
  const tieOn = watch('tiebreak_enabled')
  const showSuddenPts = finalFmt === 'sudden_death' || finalFmt === 'super_tiebreak'

  return (
    <RulesSectionCard
      id="card-rules-match"
      title="Reglas de partido"
      description="Define el formato de juego, sets, tipo de set y desempate para validar marcadores correctamente."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900">Formato de partido</p>
          <FieldHint>Elige cuántos sets se juegan y cuántos se necesitan para ganar.</FieldHint>
          <Select
            value={matchFormat}
            onValueChange={(v) => setValue('match_format', v as MatchFormatId, { shouldDirty: true, shouldValidate: true })}
          >
            <SelectTrigger id="rules-match-format" className="h-11">
              <SelectValue>{MATCH_FORMAT_LABEL[matchFormat] ?? matchFormat}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {matchFormatOrder.map((id) => (
                <SelectItem key={id} value={id}>
                  {MATCH_FORMAT_LABEL[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900">Tipo de set</p>
          <FieldHint>Define cómo se gana cada set (lenguaje operativo para el staff).</FieldHint>
          <Select
            value={setType}
            onValueChange={(v) => setValue('set_type', v as SetTypeId, { shouldDirty: true })}
          >
            <SelectTrigger id="rules-set-type" className="h-11">
              <SelectValue>{SET_TYPE_LABEL[setType] ?? setType}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {setTypeOrder.map((id) => (
                <SelectItem key={id} value={id}>
                  {SET_TYPE_LABEL[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900">Games por set</p>
          <FieldHint>Número base de games para ganar un set.</FieldHint>
          <Select
            value={String(gamesPerSet)}
            onValueChange={(v) => setValue('games_per_set', Number(v) as 4 | 6 | 8, { shouldDirty: true, shouldValidate: true })}
          >
            <SelectTrigger id="rules-games-per-set" className="h-11">
              <SelectValue>{gamesPerSet}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="6">6</SelectItem>
              <SelectItem value="8">8</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900">Diferencia mínima</p>
          <FieldHint>Diferencia requerida para cerrar un set (6-4 válido; 6-5 no válido con diferencia 2).</FieldHint>
          <Select
            value={String(minDiff)}
            onValueChange={(v) =>
              setValue('min_game_difference', Number(v) as 1 | 2, { shouldDirty: true, shouldValidate: true })
            }
          >
            <SelectTrigger id="rules-min-diff" className="h-11">
              <SelectValue>{minDiff === 2 ? '2 games' : '1 game'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 game</SelectItem>
              <SelectItem value="2">2 games</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <SwitchRow
            id="rules-tiebreak-enabled"
            label="Tie-break"
            description="Permite cerrar un set empatado en games con un tie-break (p. ej. 7-6)."
            checked={tieOn}
            onCheckedChange={(v) => {
              setValue('tiebreak_enabled', v, { shouldDirty: true, shouldValidate: true })
              if (!v) setValue('tiebreak_at', null, { shouldDirty: true, shouldValidate: true })
              else setValue('tiebreak_at', 6, { shouldDirty: true, shouldValidate: true })
            }}
          />
        </div>

        {tieOn ? (
          <div className="space-y-2 md:col-span-2">
            <p className="text-sm font-medium text-slate-900">Tie-break en</p>
            <FieldHint>{tiebreakAtLabel(tiebreakAt, true)}</FieldHint>
            <Select
              value={tiebreakAt === 5 ? '5' : '6'}
              onValueChange={(v) => setValue('tiebreak_at', v === '5' ? 5 : 6, { shouldDirty: true, shouldValidate: true })}
            >
              <SelectTrigger id="rules-tiebreak-at" className="h-11 max-w-md">
                <SelectValue>{tiebreakAt === 5 ? '5-5' : '6-6 (clásico)'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6-6 (clásico)</SelectItem>
                <SelectItem value="5">5-5</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-2 md:col-span-2">
          <p className="text-sm font-medium text-slate-900">Tercer set (o set decisivo)</p>
          <FieldHint>Cómo se juega el último set cuando ambos van empatados a sets.</FieldHint>
          <Select
            value={finalFmt}
            onValueChange={(v) =>
              setValue('final_set_format', v as FinalSetFormatId, { shouldDirty: true, shouldValidate: true })
            }
          >
            <SelectTrigger id="rules-final-set" className="h-11">
              <SelectValue>{FINAL_SET_LABEL[finalFmt] ?? finalFmt}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {finalSetOrder.map((id) => (
                <SelectItem key={id} value={id}>
                  {FINAL_SET_LABEL[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showSuddenPts ? (
          <div className="space-y-2 md:col-span-2">
            <p className="text-sm font-medium text-slate-900">Puntos de muerte súbita / super tie-break</p>
            <FieldHint>Puntos mínimos para ganar el desempate (con diferencia de 2, p. ej. 10-8).</FieldHint>
            <Select
              value={String(suddenPts)}
              onValueChange={(v) =>
                setValue('sudden_death_points', Number(v) as 7 | 10, { shouldDirty: true, shouldValidate: true })
              }
            >
              <SelectTrigger id="rules-sudden-pts" className="h-11 max-w-md">
                <SelectValue>{suddenDeathLabel(suddenPts)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{suddenDeathLabel(7)}</SelectItem>
                <SelectItem value="10">{suddenDeathLabel(10)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="md:col-span-2 space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opciones extra de validación</p>
          <SwitchRow
            id="rules-allow-76"
            label="Permitir marcador 7-6"
            description="Útil si tu reglamento lo menciona explícitamente."
            checked={watch('allow_7_6')}
            onCheckedChange={(v) => setValue('allow_7_6', v, { shouldDirty: true })}
          />
          <SwitchRow
            id="rules-allow-75"
            label="Permitir marcador 7-5"
            description="Opcional según reglamento interno."
            checked={watch('allow_7_5')}
            onCheckedChange={(v) => setValue('allow_7_5', v, { shouldDirty: true })}
          />
          <SwitchRow
            id="rules-allow-player-score"
            label="Los jugadores pueden capturar marcador"
            description="Si se desactiva, solo staff/admin registra resultados."
            checked={watch('allow_player_score_entry')}
            onCheckedChange={(v) => setValue('allow_player_score_entry', v, { shouldDirty: true })}
          />
        </div>
      </div>

      {formState.errors.match_format ? (
        <p className="text-xs text-red-600">{formState.errors.match_format.message}</p>
      ) : null}
    </RulesSectionCard>
  )
}
