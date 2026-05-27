import { AlertTriangle, CheckCircle2, ChevronDown, Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { formatCompactMatchScoreFromWinnerPerspective } from '@/components/shared/MatchSportsFeed'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formValuesToMatchRulesTournament, rulesRowToFormValues } from '@/domain/tournamentRulesForm'
import { scoreSideNumericInputHandlers } from '@/lib/scoreSideNumericInput'
import { cn } from '@/lib/utils'
import { isSuddenDeathRowIndex, maxSetsFromRules } from '@/lib/tournamentRulesEngine'
import type { AdminMatchRecord } from '@/services/admin'
import type { ScoreSet, TournamentRules } from '@/types/database'
import { validateScoreWithRules } from '@/utils/score'

function rowLabel(index: number, rules: TournamentRules) {
  if (!isSuddenDeathRowIndex(index, rules)) return `Set ${index + 1}`
  return rules.final_set_format === 'super_tiebreak' ? `STB` : `MS`
}

function DisputeContextBanner({ match }: { match: AdminMatchRecord }) {
  const scoreLabel = formatCompactMatchScoreFromWinnerPerspective(
    match.score_raw,
    match.winner_id,
    match.player_a_id,
    match.player_b_id,
  )

  return (
    <div className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0 space-y-1 text-xs leading-snug text-amber-950">
          <p>
            <span className="font-semibold">Marcador registrado:</span>{' '}
            <span className="font-mono font-bold tabular-nums">{scoreLabel ?? '—'}</span>
          </p>
          {match.dispute_reason ? (
            <p className="text-pretty">
              <span className="font-semibold">Motivo refutación:</span> {match.dispute_reason}
            </p>
          ) : null}
          <p className="text-[10px] text-amber-800/90">
            {match.scoreSubmittedByLabel ? `Enviado por ${match.scoreSubmittedByLabel}` : null}
            {match.scoreSubmittedByLabel && match.disputedByLabel ? ' · ' : null}
            {match.disputedByLabel ? `Refutó ${match.disputedByLabel}` : null}
          </p>
        </div>
      </div>
    </div>
  )
}

export function AdminScoreCorrectionModal({
  match,
  rules,
  open,
  onOpenChange,
  onSubmit,
  title: titleProp,
  description: descriptionProp,
  elementIdPrefix = 'admin-score-correction',
  submitPending = false,
}: {
  match: AdminMatchRecord | null
  rules: TournamentRules | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: { match: AdminMatchRecord; sets: ScoreSet[]; closeAfter: boolean; adminNote: string }) => void
  title?: string
  description?: string
  elementIdPrefix?: string
  submitPending?: boolean
}) {
  const effectiveRules = useMemo(
    () => rules ?? formValuesToMatchRulesTournament(rulesRowToFormValues(null)),
    [rules],
  )
  const [sets, setSets] = useState<ScoreSet[]>([{ a: 0, b: 0 }])
  const [adminNote, setAdminNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)

  useEffect(() => {
    if (!open || !match) return
    setSets(match.score_raw?.length ? match.score_raw.map((s) => ({ a: s.a, b: s.b })) : [{ a: 0, b: 0 }])
    setAdminNote(match.admin_notes ?? '')
    setNoteOpen(Boolean(match.admin_notes?.trim()))
  }, [match, open])

  if (!match) return null

  const maxSets = maxSetsFromRules(effectiveRules)
  const disputed = match.status === 'score_disputed'

  const setNumeric = (index: number, side: keyof ScoreSet, next: number) => {
    const nextSets = [...sets]
    nextSets[index] = { ...nextSets[index], [side]: next }
    setSets(nextSets)
  }

  const submit = (closeAfter: boolean) => {
    const validation = validateScoreWithRules(sets, effectiveRules)
    if (!validation.ok) {
      toast.error(validation.errors[0] ?? 'Marcador inválido')
      return
    }
    if (disputed && !closeAfter) return
    onSubmit({ match, sets, closeAfter: disputed ? true : closeAfter, adminNote })
  }

  const modalTitle = titleProp ?? (disputed ? 'Editar marcador' : 'Corregir marcador')
  const modalDescription =
    descriptionProp ??
    (disputed
      ? 'Ajusta el resultado y valídalo para cerrar la disputa.'
      : `${match.playerAName} vs ${match.playerBName}`)

  return (
    <AdminFormModal
      open={open}
      onOpenChange={onOpenChange}
      contentId={elementIdPrefix}
      contentDataName="score-correction-modal"
      title={modalTitle}
      description={modalDescription}
      contentClassName="flex max-h-[min(100dvh-1rem,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md [&_[data-slot=dialog-header]]:px-5 [&_[data-slot=dialog-header]]:pb-2 [&_[data-slot=dialog-header]]:pt-5 sm:[&_[data-slot=dialog-header]]:pt-6"
      descriptionClassName="text-xs"
    >
      <div
        id={`${elementIdPrefix}-form`}
        data-name="score-correction-form"
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-1 sm:px-5">
          {disputed ? <DisputeContextBanner match={match} /> : null}

          <div
            id={`${elementIdPrefix}-sets`}
            data-name="score-correction-sets"
            className="overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/50"
          >
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto_minmax(0,1fr)_2rem] items-center gap-x-1.5 border-b border-slate-200/80 bg-white px-2 py-2">
              <span />
              <span
                className="truncate text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                title={match.playerAName}
              >
                {match.playerAName}
              </span>
              <span className="text-center text-[10px] text-slate-300" aria-hidden>
                vs
              </span>
              <span
                className="truncate text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                title={match.playerBName}
              >
                {match.playerBName}
              </span>
              <span />
            </div>

            {sets.map((set, index) => (
              <div
                key={index}
                id={`${elementIdPrefix}-set-${index}`}
                data-name="score-correction-set-row"
                className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto_minmax(0,1fr)_2rem] items-center gap-x-1.5 border-b border-slate-200/60 px-2 py-1.5 last:border-b-0"
              >
                <span
                  className="text-[10px] font-semibold tabular-nums text-slate-400"
                  title={rowLabel(index, effectiveRules)}
                >
                  {rowLabel(index, effectiveRules)}
                </span>
                <Input
                  id={`${elementIdPrefix}-set-${index}-a`}
                  name={`set-${index}-player-a`}
                  data-name="score-correction-set-player-a"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`${match.playerAName} set ${index + 1}`}
                  className="h-10 w-full min-w-0 border-slate-200 bg-white text-center text-lg font-bold tabular-nums shadow-none"
                  {...scoreSideNumericInputHandlers(set.a, (n) => setNumeric(index, 'a', n))}
                />
                <span className="px-0.5 font-mono text-sm font-bold text-slate-300" aria-hidden>
                  -
                </span>
                <Input
                  id={`${elementIdPrefix}-set-${index}-b`}
                  name={`set-${index}-player-b`}
                  data-name="score-correction-set-player-b"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`${match.playerBName} set ${index + 1}`}
                  className="h-10 w-full min-w-0 border-slate-200 bg-white text-center text-lg font-bold tabular-nums shadow-none"
                  {...scoreSideNumericInputHandlers(set.b, (n) => setNumeric(index, 'b', n))}
                />
                <Button
                  type="button"
                  id={`${elementIdPrefix}-set-${index}-remove`}
                  name={`remove-set-${index}`}
                  data-name="score-correction-remove-set"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-slate-400 hover:text-red-600"
                  disabled={sets.length === 1}
                  aria-label={`Quitar set ${index + 1}`}
                  onClick={() => setSets(sets.filter((_, setIndex) => setIndex !== index))}
                >
                  <Minus className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              id={`${elementIdPrefix}-add-set`}
              name="add-set"
              data-name="score-correction-add-set"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={sets.length >= maxSets}
              onClick={() => setSets([...sets, { a: 0, b: 0 }])}
            >
              <Plus className="size-3.5" />
              Agregar set
            </Button>
            <p className="text-[10px] text-slate-400">
              Máx. {maxSets} {maxSets === 1 ? 'set' : 'sets'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-slate-600 hover:text-slate-900"
              aria-expanded={noteOpen}
              onClick={() => setNoteOpen((v) => !v)}
            >
              <span>Nota administrativa {adminNote.trim() ? '(con texto)' : '(opcional)'}</span>
              <ChevronDown className={cn('size-4 transition-transform', noteOpen && 'rotate-180')} aria-hidden />
            </button>
            {noteOpen ? (
              <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                <Textarea
                  id={`${elementIdPrefix}-note`}
                  name="admin-note"
                  data-name="score-correction-admin-note"
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  placeholder="Motivo de la corrección o criterio aplicado"
                  className="min-h-20 resize-none text-sm"
                />
              </div>
            ) : null}
          </div>

          {!disputed ? (
            <p className="text-xs leading-relaxed text-slate-500">
              Guarda una corrección pendiente o confirma el resultado para hacerlo oficial en el ranking.
            </p>
          ) : null}
        </div>

        <div
          id={`${elementIdPrefix}-actions`}
          data-name="score-correction-actions"
          className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-sm sm:flex-row sm:justify-end sm:px-5"
        >
          <Button
            type="button"
            id={`${elementIdPrefix}-cancel`}
            name="cancel-score-correction"
            data-name="score-correction-cancel"
            variant="outline"
            className="h-10 sm:h-9"
            disabled={submitPending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          {!disputed ? (
            <Button
              type="button"
              id={`${elementIdPrefix}-save-draft`}
              name="save-score-correction"
              data-name="score-correction-save-draft"
              variant="outline"
              className="h-10 sm:h-9"
              disabled={submitPending}
              onClick={() => submit(false)}
            >
              Guardar corrección
            </Button>
          ) : null}
          <Button
            type="button"
            id={`${elementIdPrefix}-confirm`}
            name="confirm-score-correction"
            data-name="score-correction-confirm"
            className="h-10 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 sm:h-9"
            disabled={submitPending}
            onClick={() => submit(true)}
          >
            <CheckCircle2 className="size-3.5 opacity-90" />
            {submitPending
              ? 'Guardando…'
              : disputed
                ? 'Validar resultado'
                : 'Confirmar resultado'}
          </Button>
        </div>
      </div>
    </AdminFormModal>
  )
}
