import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formValuesToMatchRulesTournament, rulesRowToFormValues } from '@/domain/tournamentRulesForm'
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
}: {
  match: AdminMatchRecord | null
  rules: TournamentRules | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: { match: AdminMatchRecord; sets: ScoreSet[]; closeAfter: boolean; adminNote: string }) => void
}) {
  const effectiveRules = useMemo(
    () => rules ?? formValuesToMatchRulesTournament(rulesRowToFormValues(null)),
    [rules],
  )
  const [sets, setSets] = useState<ScoreSet[]>([{ a: 0, b: 0 }])
  const [adminNote, setAdminNote] = useState('')

  useEffect(() => {
    if (!open || !match) return
    setSets(match.score_raw?.length ? match.score_raw.map((s) => ({ a: s.a, b: s.b })) : [{ a: 0, b: 0 }])
    setAdminNote(match.admin_notes ?? '')
  }, [match, open])

  if (!match) return null

  const maxSets = maxSetsFromRules(effectiveRules)
  const setValue = (index: number, side: keyof ScoreSet, value: string) => {
    const next = [...sets]
    next[index] = { ...next[index], [side]: Math.max(0, Number(value) || 0) }
    setSets(next)
  }

  const submit = (closeAfter: boolean) => {
    const validation = validateScoreWithRules(sets, effectiveRules)
    if (!validation.ok) {
      toast.error(validation.errors[0] ?? 'Marcador inválido')
      return
    }
    onSubmit({ match, sets, closeAfter, adminNote })
  }

  return (
    <AdminFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Corregir marcador"
      description={`${match.playerAName} vs ${match.playerBName}`}
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
                    value={set.a}
                    onChange={(event) => setValue(index, 'a', event.target.value)}
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
                    value={set.b}
                    onChange={(event) => setValue(index, 'b', event.target.value)}
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
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          Guarda una corrección para dejarla pendiente de cierre, o confirma el resultado para hacerlo oficial y
          enviarlo al ranking.
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
