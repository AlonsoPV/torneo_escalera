import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formValuesToMatchRulesTournament, rulesRowToFormValues } from '@/domain/tournamentRulesForm'
import { scoreSideNumericInputHandlers } from '@/lib/scoreSideNumericInput'
import { isSuddenDeathRowIndex, maxSetsFromRules } from '@/lib/tournamentRulesEngine'
import type { AdminMatchRecord } from '@/services/admin'
import type { ScoreSet, TournamentRules } from '@/types/database'
import { validateScoreWithRules } from '@/utils/score'

function rowLabel(index: number, rules: TournamentRules) {
  if (!isSuddenDeathRowIndex(index, rules)) return `Set ${index + 1}`
  return rules.final_set_format === 'super_tiebreak'
    ? `Set ${index + 1} / Super tie-break`
    : `Set ${index + 1} / Muerte súbita`
}

export function AdminScoreCorrectionModal({
  match,
  rules,
  open,
  onOpenChange,
  onSubmit,
  title: titleProp,
  description: descriptionProp,
}: {
  match: AdminMatchRecord | null
  rules: TournamentRules | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: { match: AdminMatchRecord; sets: ScoreSet[]; closeAfter: boolean; adminNote: string }) => void
  /** Título del modal (p. ej. registrar / corregir / resolver refutación). */
  title?: string
  /** Subtítulo; por defecto “Jugador A vs Jugador B”. */
  description?: string
}) {
  const effectiveRules = useMemo(
    () => rules ?? formValuesToMatchRulesTournament(rulesRowToFormValues(null)),
    [rules],
  )
  const [sets, setSets] = useState<ScoreSet[]>([{ a: 0, b: 0 }])
  const [adminNote, setAdminNote] = useState('')
  /** Solo disputa: si está activo, «Confirmar resultado» pasa a validado; si no, sigue en revisión. */
  const [applyValidateFromDispute, setApplyValidateFromDispute] = useState(true)

  useEffect(() => {
    if (!open || !match) return
    setSets(match.score_raw?.length ? match.score_raw.map((s) => ({ a: s.a, b: s.b })) : [{ a: 0, b: 0 }])
    setAdminNote(match.admin_notes ?? '')
    setApplyValidateFromDispute(true)
  }, [match, open])

  if (!match) return null

  const maxSets = maxSetsFromRules(effectiveRules)
  const setNumeric = (index: number, side: keyof ScoreSet, next: number) => {
    const nextSets = [...sets]
    nextSets[index] = { ...nextSets[index], [side]: next }
    setSets(nextSets)
  }

  const disputed = match.status === 'score_disputed'

  const submit = (closeAfter: boolean) => {
    const validation = validateScoreWithRules(sets, effectiveRules)
    if (!validation.ok) {
      toast.error(validation.errors[0] ?? 'Marcador inválido')
      return
    }
    const effectiveCloseAfter = disputed ? closeAfter && applyValidateFromDispute : closeAfter
    onSubmit({ match, sets, closeAfter: effectiveCloseAfter, adminNote })
  }

  return (
    <AdminFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={titleProp ?? 'Corregir marcador'}
      description={descriptionProp ?? `${match.playerAName} vs ${match.playerBName}`}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          {sets.map((set, index) => (
            <div key={index} className="space-y-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-slate-900">{rowLabel(index, effectiveRules)}</p>
                  <p className="text-xs leading-snug text-slate-500">Captura el marcador para cada jugador.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-xs text-slate-500"
                  disabled={sets.length === 1}
                  onClick={() => setSets(sets.filter((_, setIndex) => setIndex !== index))}
                >
                  Quitar
                </Button>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <Label htmlFor={`admin-set-${index}-a`} className="block text-pretty text-[11px] leading-snug text-slate-500">
                    {match.playerAName}
                  </Label>
                  <Input
                    id={`admin-set-${index}-a`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="mt-1.5 h-12 w-full min-w-0 text-center text-xl font-bold tabular-nums"
                    {...scoreSideNumericInputHandlers(set.a, (n) => setNumeric(index, 'a', n))}
                  />
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <Label htmlFor={`admin-set-${index}-b`} className="block text-pretty text-[11px] leading-snug text-slate-500">
                    {match.playerBName}
                  </Label>
                  <Input
                    id={`admin-set-${index}-b`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="mt-1.5 h-12 w-full min-w-0 text-center text-xl font-bold tabular-nums"
                    {...scoreSideNumericInputHandlers(set.b, (n) => setNumeric(index, 'b', n))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={sets.length >= maxSets}
            onClick={() => setSets([...sets, { a: 0, b: 0 }])}
          >
            Agregar set
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-note">Nota del admin</Label>
          <Textarea
            id="admin-note"
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            placeholder="Motivo de la corrección o criterio aplicado"
          />
        </div>
        {disputed ? (
          <div className="space-y-2 rounded-xl border border-amber-200/90 bg-amber-50/90 p-3">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug text-amber-950">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded border-amber-400 text-[#1F5A4C] focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/30"
                checked={applyValidateFromDispute}
                onChange={(e) => setApplyValidateFromDispute(e.target.checked)}
              />
              <span>
                <span className="font-semibold">Aplicar y validar oficialmente</span>
                <span className="mt-0.5 block text-xs font-normal text-amber-900/90">
                  Si está marcado, «Confirmar resultado» cierra la revisión y el marcador queda validado para el ranking.
                  Desmárcalo para guardar cambios y seguir en «pendiente de revisión».
                </span>
              </span>
            </label>
          </div>
        ) : null}
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {disputed ? (
            <>
              «Guardar corrección» actualiza el marcador pero puede dejar el partido en revisión según la casilla de
              validación. «Confirmar resultado» valida y envía al ranking solo si «Aplicar y validar oficialmente» está
              activo.
            </>
          ) : (
            <>
              Guarda una corrección para dejarla pendiente de cierre, o confirma el resultado para hacerlo oficial y
              enviarlo al ranking.
            </>
          )}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" onClick={() => submit(false)}>
            Guardar corrección
          </Button>
          <Button type="button" onClick={() => submit(true)}>
            Confirmar resultado
          </Button>
        </div>
      </div>
    </AdminFormModal>
  )
}
