import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formValuesToMatchRulesTournament, rulesRowToFormValues } from '@/domain/tournamentRulesForm'
import { isSuddenDeathRowIndex, maxSetsFromRules } from '@/lib/tournamentRulesEngine'
import type { AdminMatchRecord } from '@/services/admin'
import type { ScoreSet, TournamentRules } from '@/types/database'
import { validateScoreWithRules } from '@/utils/score'

function setRowHeading(index: number, rules: TournamentRules): string {
  if (isSuddenDeathRowIndex(index, rules)) {
    if (rules.final_set_format === 'super_tiebreak') return `Set ${index + 1} / Super tie-break`
    return `Set ${index + 1} / Muerte súbita`
  }
  return `Set ${index + 1}`
}

function ScoreEditorForm({
  match,
  rules,
  onSubmit,
}: {
  match: AdminMatchRecord
  rules: TournamentRules | null
  onSubmit: (match: AdminMatchRecord, sets: ScoreSet[]) => void
}) {
  const effectiveRules = useMemo(
    () => rules ?? formValuesToMatchRulesTournament(rulesRowToFormValues(null)),
    [rules],
  )
  const maxSets = maxSetsFromRules(effectiveRules)

  const initialSets = match.score_raw?.length ? match.score_raw : [{ a: 0, b: 0 }]
  const [sets, setSets] = useState<ScoreSet[]>(initialSets)

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        const cleaned = sets.filter((set) => Number.isFinite(set.a) && Number.isFinite(set.b))
        const v = validateScoreWithRules(cleaned, effectiveRules)
        if (!v.ok) {
          toast.error(v.errors[0] ?? 'Marcador inválido')
          return
        }
        onSubmit(match, cleaned)
      }}
    >
      <div className="space-y-3">
        {sets.map((set, index) => {
          const sudden = isSuddenDeathRowIndex(index, effectiveRules)
          const rowTitle = setRowHeading(index, effectiveRules)
          return (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor={`set-${index}-a`} className="text-xs font-medium leading-snug">
                  {sudden ? `${match.playerAName} — puntos` : `${rowTitle} · ${match.playerAName}`}
                </Label>
                <Input
                  id={`set-${index}-a`}
                  type="number"
                  min={0}
                  value={set.a}
                  onChange={(event) => {
                    const next = [...sets]
                    next[index] = { ...set, a: Number(event.target.value) }
                    setSets(next)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`set-${index}-b`} className="text-xs font-medium leading-snug">
                  {sudden ? `${match.playerBName} — puntos` : `${rowTitle} · ${match.playerBName}`}
                </Label>
                <Input
                  id={`set-${index}-b`}
                  type="number"
                  min={0}
                  value={set.b}
                  onChange={(event) => {
                    const next = [...sets]
                    next[index] = { ...set, b: Number(event.target.value) }
                    setSets(next)
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={sets.length === 1}
                onClick={() => setSets(sets.filter((_, setIndex) => setIndex !== index))}
              >
                Quitar
              </Button>
            </div>
          )
        })}
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
        <Button type="submit">Guardar corrección</Button>
      </div>
    </form>
  )
}

export function ScoreEditorModal({
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
  onSubmit: (match: AdminMatchRecord, sets: ScoreSet[]) => void
}) {
  if (!match) return null

  return (
    <AdminFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Corregir marcador"
      description={`${match.playerAName} vs ${match.playerBName}`}
    >
      <ScoreEditorForm key={match.id} match={match} rules={rules} onSubmit={onSubmit} />
    </AdminFormModal>
  )
}
