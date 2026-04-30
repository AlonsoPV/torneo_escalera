import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'

import type { TournamentRulesFormValues } from '@/domain/tournamentRulesForm'
import { formValuesToMatchRulesTournament } from '@/domain/tournamentRulesForm'
import {
  buildMatchRulesNarrative,
  matchRulesInvalidExamples,
  matchRulesValidExamples,
} from '@/lib/matchRulesNarrative'
import { validateTennisScore } from '@/lib/tournamentRulesEngine'
import { previewDefaultMatchPoints, previewNormalMatchPoints } from '@/lib/tournamentRulesPreview'

import { RulesSectionCard } from './rulesUi'

export function RulesPreviewCard() {
  const { watch } = useFormContext<TournamentRulesFormValues>()
  const win = watch('points_per_win')
  const loss = watch('points_per_loss')
  const defW = watch('points_default_win')
  const defL = watch('points_default_loss')

  const values = watch() as TournamentRulesFormValues
  const matchNarrative = buildMatchRulesNarrative(values)
  const rulesForValidation = formValuesToMatchRulesTournament(values)

  const normal = useMemo(() => previewNormalMatchPoints({ points_per_win: win, points_per_loss: loss }), [win, loss])
  const def = useMemo(() => previewDefaultMatchPoints({ points_default_win: defW, points_default_loss: defL }), [defW, defL])

  const exampleChecks = {
    valid: [
      validateTennisScore(
        [
          { a: 6, b: 3 },
          { a: 6, b: 4 },
        ],
        rulesForValidation,
      ),
      validateTennisScore(
        [
          { a: 6, b: 4 },
          { a: 4, b: 6 },
          { a: 10, b: 7 },
        ],
        rulesForValidation,
      ),
      validateTennisScore(
        [
          { a: 7, b: 6 },
          { a: 6, b: 3 },
        ],
        rulesForValidation,
      ),
    ],
    invalid: [
      validateTennisScore(
        [
          { a: 6, b: 5 },
          { a: 6, b: 4 },
        ],
        rulesForValidation,
      ),
      validateTennisScore(
        [
          { a: 6, b: 3 },
          { a: 5, b: 5 },
        ],
        rulesForValidation,
      ),
      validateTennisScore([{ a: 10, b: 7 }], rulesForValidation),
    ],
  }

  return (
    <RulesSectionCard
      id="card-rules-preview"
      title="Vista previa de reglas"
      description="Puntos de ranking y formato de partido con la configuración actual (ejemplos ilustrativos)."
    >
      <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Partido normal</p>
          <p className="mt-1 text-sm text-slate-700">
            Jugador A gana 6-3, 6-4 frente a Jugador B
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-900">
            <li>
              <span className="font-medium">Jugador A:</span> +{normal.winnerPts} pts
            </li>
            <li>
              <span className="font-medium">Jugador B:</span> +{normal.loserPts} pt{normal.loserPts === 1 ? '' : 's'}
            </li>
          </ul>
        </div>
        <div className="border-t border-slate-200/80 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Victoria por default</p>
          <p className="mt-1 text-sm text-slate-700">Jugador A gana por default (W/O)</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-900">
            <li>
              <span className="font-medium">Jugador A:</span> +{def.winnerPts} pts
            </li>
            <li>
              <span className="font-medium">Jugador B:</span> {def.loserPts >= 0 ? '+' : ''}
              {def.loserPts} pt{Math.abs(def.loserPts) === 1 ? '' : 's'}
            </li>
          </ul>
        </div>

        <div className="border-t border-slate-200/80 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Formato de partido</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-800">{matchNarrative}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-slate-600">Marcadores válidos (referencia)</p>
              <ul className="mt-2 space-y-1.5 font-mono text-xs text-slate-800">
                {matchRulesValidExamples().map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                Comprobación rápida con tu configuración actual (tie-break, tercer set, etc.):
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
                {exampleChecks.valid.map((res, i) => (
                  <li key={i}>
                    {res.ok ? (
                      <span className="text-emerald-700">Válido según reglas actuales</span>
                    ) : (
                      <span className="text-amber-800">Revisar: {res.errors[0]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">Marcadores no válidos (referencia)</p>
              <ul className="mt-2 space-y-1.5 font-mono text-xs text-slate-800">
                {matchRulesInvalidExamples().map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
                {exampleChecks.invalid.map((res, i) => (
                  <li key={i}>
                    {!res.ok ? (
                      <span className="text-rose-700">{res.errors[0]}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </RulesSectionCard>
  )
}
