import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { canPlayerACaptureScore, canPlayerBRespondToScore } from '@/lib/matchStatus'
import { canEditMatchAsAdmin } from '@/lib/permissions'
import { isSuddenDeathRowIndex, maxSetsFromRules } from '@/lib/tournamentRulesEngine'
import { cn } from '@/lib/utils'
import { respondOpponentMatchScore } from '@/services/matches'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'
import { formatScoreCompact, invertScoreSets, validateScoreWithRules } from '@/utils/score'

const scoreInputClass = cn(
  'box-border h-12 w-full max-w-[5rem] min-w-[3.25rem] sm:max-w-[5.5rem]',
  'border-2 text-center text-xl font-semibold tabular-nums leading-none tracking-tight',
  'text-foreground shadow-sm transition-colors',
  'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25',
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
)

const setSchema = z.object({
  a: z.coerce.number().int().min(0),
  b: z.coerce.number().int().min(0),
})

const formSchema = z.object({
  sets: z
    .array(setSchema)
    .min(1)
    .superRefine((sets, ctx) => {
      sets.forEach((s, i) => {
        if (s.a === s.b) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Un set no puede terminar empatado; indica el ganador (p. ej. 6-4, 7-6).',
            path: [i, 'b'],
          })
        }
      })
    }),
})

type FormValues = z.infer<typeof formSchema>

function namesForMatch(match: MatchRow, players: GroupPlayer[]) {
  const pa = players.find((p) => p.id === match.player_a_id)
  const pb = players.find((p) => p.id === match.player_b_id)
  return {
    a: pa?.display_name ?? 'A',
    b: pb?.display_name ?? 'B',
  }
}

/** Etiqueta corta para la cabecera de columnas (evita nombres largos en móvil). */
function shortLabel(name: string, max = 12) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const w = parts[0] ?? name
  if (w.length <= max) return w
  return `${w.slice(0, max - 1)}…`
}

export function MatchScoreSheet(props: {
  open: boolean
  onOpenChange: (v: boolean) => void
  match: MatchRow | null
  players: GroupPlayer[]
  rules: TournamentRules | null
  currentUserId: string | null
  isAdmin: boolean
  onSave: (sets: { a: number; b: number }[]) => Promise<void>
  onAfterScoreFlow?: () => Promise<void>
}) {
  const { open, onOpenChange, match, players, rules, currentUserId, isAdmin, onSave, onAfterScoreFlow } =
    props
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [responding, setResponding] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { sets: [{ a: 0, b: 0 }] },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'sets',
  })

  const matchId = match?.id ?? ''
  const scoreKey =
    match?.score_raw && match.score_raw.length > 0
      ? JSON.stringify(match.score_raw)
      : 'empty'

  useEffect(() => {
    if (!open || !match) return
    const defaults =
      match.score_raw && match.score_raw.length > 0
        ? { sets: match.score_raw.map((s) => ({ a: s.a, b: s.b })) }
        : { sets: [{ a: 0, b: 0 }] }
    form.reset(defaults)
  }, [open, matchId, scoreKey, match, form])

  useEffect(() => {
    if (!open) {
      setRejectOpen(false)
      setRejectReason('')
      setResponding(false)
    }
  }, [open, matchId])

  if (!match || !rules) return null

  const maxSets = maxSetsFromRules(rules)
  const hasPointsDecider =
    maxSets >= 3 &&
    (rules.final_set_format === 'sudden_death' || rules.final_set_format === 'super_tiebreak')
  const { a: nameA, b: nameB } = namesForMatch(match, players)
  const participant =
    currentUserId === match.player_a_user_id ||
    currentUserId === match.player_b_user_id

  const allowEntry = rules.allow_player_score_entry
  const canACapture = canPlayerACaptureScore({
    match,
    userId: currentUserId,
    allowPlayerScoreEntry: allowEntry,
  })
  const showOpponentPanel =
    !isAdmin &&
    canPlayerBRespondToScore({
      match,
      userId: currentUserId,
      allowPlayerScoreEntry: allowEntry,
    })
  const formEditable = canEditMatchAsAdmin(isAdmin) || canACapture

  const watched = form.watch('sets')
  const preview = formatScoreCompact(invertScoreSets(watched ?? []))

  const submit = form.handleSubmit(async (values) => {
    const v = validateScoreWithRules(values.sets, rules)
    if (!v.ok) {
      toast.error(v.errors[0] ?? 'Marcador no válido para este torneo')
      return
    }
    await onSave(values.sets)
    await onAfterScoreFlow?.()
    onOpenChange(false)
  })

  const flowAfter = async () => {
    await onAfterScoreFlow?.()
    onOpenChange(false)
  }

  const handleAcceptOpponent = async () => {
    setResponding(true)
    try {
      await respondOpponentMatchScore({ matchId: match.id, accept: true })
      toast.success('Marcador aceptado. Queda pendiente la validación del organizador.')
      await flowAfter()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar la aceptación')
    } finally {
      setResponding(false)
    }
  }

  const handleRejectOpponent = async () => {
    const reason = rejectReason.trim()
    if (reason.length < 3) {
      toast.error('Escribe el motivo del rechazo (mín. 3 caracteres).')
      return
    }
    setResponding(true)
    try {
      await respondOpponentMatchScore({ matchId: match.id, accept: false, disputeReason: reason })
      toast.message('Marcador rechazado', { description: 'El Jugador A podrá corregir y reenviar.' })
      setRejectOpen(false)
      setRejectReason('')
      await flowAfter()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar el rechazo')
    } finally {
      setResponding(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[min(90dvh,40rem)] flex-col gap-0 rounded-t-2xl p-0 sm:mx-auto sm:max-w-lg"
      >
        <div className="shrink-0 space-y-1 border-b border-border/80 px-4 pb-3 pt-2 sm:px-5">
          <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
          <SheetHeader className="space-y-1.5 p-0 text-left">
            <SheetTitle className="text-lg">Marcador</SheetTitle>
            <SheetDescription className="line-clamp-4 text-balance sm:text-sm">
              {showOpponentPanel ? (
                `${nameA} registró el marcador. Revísalo y acéptalo o recházalo con un comentario. No puedes editar los números directamente.`
              ) : (
                <>
                  {isAdmin
                    ? `Como staff puedes ajustar el marcador. Al guardar se cierra oficialmente el partido (ranking).`
                    : hasPointsDecider
                      ? `Eres el Jugador A: hasta ${maxSets} sets; los primeros van por games y el decisivo por puntos si aplica. Puedes enviar el marcador cuando el partido haya terminado.`
                      : `Eres el Jugador A: introduce games por set (hasta ${maxSets} sets). Puedes enviar el marcador cuando el partido haya terminado.`}{' '}
                  Cada set debe tener ganador: no se permiten marcadores empatados (p. ej. 6-6 no es un resultado final válido).
                </>
              )}
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-3 sm:px-5">
            {match.status === 'score_disputed' && match.dispute_reason ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
                  Motivo del rechazo del rival
                </p>
                <p className="mt-1 leading-relaxed text-amber-950/90">{match.dispute_reason}</p>
              </div>
            ) : null}
            {(() => {
              const se = form.formState.errors.sets
              if (!se) return null
              if (typeof (se as { message?: string }).message === 'string') {
                return (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {(se as { message: string }).message}
                  </p>
                )
              }
              if (Array.isArray(se)) {
                const first = se.find((e) => e && (e.a?.message || e.b?.message))
                const msg = first?.a?.message ?? first?.b?.message
                if (msg) {
                  return (
                    <p role="alert" className="text-sm font-medium text-destructive">
                      {String(msg)}
                    </p>
                  )
                }
              }
              return (
                <p role="alert" className="text-sm font-medium text-destructive">
                  Revisa cada set: debe haber un ganador (no se permiten empates como 4-4 o 6-6).
                </p>
              )
            })()}
            <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-card to-muted/20 p-3 shadow-sm sm:p-4">
              <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
                <p
                  className="line-clamp-2 text-center text-sm font-semibold leading-tight text-foreground"
                  title={nameA}
                >
                  {nameA}
                </p>
                <span className="shrink-0 px-0.5 pb-2.5 text-[10px] font-bold uppercase text-muted-foreground">
                  vs
                </span>
                <p
                  className="line-clamp-2 text-center text-sm font-semibold leading-tight text-foreground"
                  title={nameB}
                >
                  {nameB}
                </p>
              </div>
              <Separator className="mb-2 bg-border/80" />
              <div className="w-full min-w-0 overflow-x-auto">
                <table
                  className="w-full min-w-[280px] table-fixed border-separate border-spacing-0"
                  aria-label={hasPointsDecider ? 'Games o puntos por set' : 'Games por set'}
                >
                  <colgroup>
                    <col className="w-12 sm:w-14" />
                    <col className="w-[38%]" />
                    <col className="w-[38%]" />
                    <col className="w-12 sm:w-14" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="pb-2 pr-1 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-xs"
                      >
                        Set
                      </th>
                      <th
                        scope="col"
                        className="px-1 pb-2 text-center text-[10px] font-bold uppercase text-muted-foreground sm:text-xs"
                        title={nameA}
                      >
                        {shortLabel(nameA)}
                      </th>
                      <th
                        scope="col"
                        className="px-1 pb-2 text-center text-[10px] font-bold uppercase text-muted-foreground sm:text-xs"
                        title={nameB}
                      >
                        {shortLabel(nameB)}
                      </th>
                      <th className="w-12 pb-2" aria-label="Quitar set">
                        <span className="sr-only">Quitar</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const sudden = isSuddenDeathRowIndex(index, rules)
                      const rowLabel = sudden
                        ? rules.final_set_format === 'super_tiebreak'
                          ? `${index + 1} / STB`
                          : `${index + 1} / MS`
                        : String(index + 1)
                      return (
                      <tr key={field.id} className="align-middle">
                        <th
                          scope="row"
                          className="pr-1 text-center text-xs font-semibold leading-tight text-foreground sm:text-sm"
                          title={
                            sudden
                              ? rules.final_set_format === 'super_tiebreak'
                                ? 'Set decisivo: super tie-break (puntos)'
                                : 'Set decisivo: muerte súbita (puntos)'
                              : undefined
                          }
                        >
                          {rowLabel}
                        </th>
                        <td className="px-1.5 py-1.5">
                          <div className="flex justify-center">
                            <Label className="sr-only" htmlFor={`set-${index}-a`}>
                              {sudden ? `${nameA}, puntos (set decisivo)` : `${nameA}, games · set ${index + 1}`}
                            </Label>
                            <Input
                              id={`set-${index}-a`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              disabled={!formEditable}
                              className={scoreInputClass}
                              {...form.register(`sets.${index}.a`, { valueAsNumber: true })}
                            />
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5">
                          <div className="flex justify-center">
                            <Label className="sr-only" htmlFor={`set-${index}-b`}>
                              {sudden ? `${nameB}, puntos (set decisivo)` : `${nameB}, games · set ${index + 1}`}
                            </Label>
                            <Input
                              id={`set-${index}-b`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              disabled={!formEditable}
                              className={scoreInputClass}
                              {...form.register(`sets.${index}.b`, { valueAsNumber: true })}
                            />
                          </div>
                        </td>
                        <td className="py-1.5 pl-1 text-right">
                          {formEditable ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-10 shrink-0 text-muted-foreground hover:text-destructive sm:size-11"
                              onClick={() => remove(index)}
                              disabled={fields.length <= 1}
                              aria-label={`Quitar set ${index + 1}`}
                            >
                              <Minus className="size-5" strokeWidth={2} />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {formEditable && fields.length < maxSets ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full gap-1.5 border-dashed text-muted-foreground"
                onClick={() => append({ a: 0, b: 0 })}
              >
                <Plus className="size-4" />
                Añadir set
              </Button>
            ) : null}

            <div className="space-y-2 rounded-xl border border-dashed border-border/90 bg-muted/15 px-3 py-3 sm:px-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Desde el rival (vista inversa)
              </p>
              <p className="font-mono text-base text-foreground">{preview || '—'}</p>
              {!isAdmin ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {showOpponentPanel ? (
                    <>Comprueba que el marcador cuadra con lo jugado. Si no estás de acuerdo, rechaza con un comentario claro.</>
                  ) : match?.status === 'score_disputed' && canACapture ? (
                    <>
                      Tu rival rechazó el marcador. Ajusta los valores y vuelve a{' '}
                      <span className="font-medium text-foreground">enviar</span> para que pueda revisarlo de nuevo.
                    </>
                  ) : (
                    <>
                      Al guardar, el marcador se envía a tu rival para revisión (no cuenta en el ranking hasta que un
                      administrador cierre el partido).
                    </>
                  )}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Como administrador, al guardar cierras el partido de forma oficial (<span className="font-medium">Cerrado</span>)
                  y el resultado entra en el ranking.
                </p>
              )}
            </div>
          </div>

          <div
            className="shrink-0 border-t border-border/80 bg-background/90 px-4 py-3 backdrop-blur-sm sm:px-5"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {showOpponentPanel ? (
              <div className="space-y-3">
                <Button
                  type="button"
                  size="lg"
                  className="h-12 w-full text-base font-semibold shadow-sm"
                  disabled={responding}
                  onClick={() => void handleAcceptOpponent()}
                >
                  Aceptar marcador
                </Button>
                {!rejectOpen ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-12 w-full"
                    disabled={responding}
                    onClick={() => setRejectOpen(true)}
                  >
                    Rechazar marcador…
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="dispute-reason" className="text-sm">
                      Motivo del rechazo (obligatorio)
                    </Label>
                    <Textarea
                      id="dispute-reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Ej.: El tercer set no fue a muerte súbita…"
                      className="min-h-[5rem] resize-y"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="flex-1"
                        disabled={responding}
                        onClick={() => {
                          setRejectOpen(false)
                          setRejectReason('')
                        }}
                      >
                        Volver
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="flex-1"
                        disabled={responding}
                        onClick={() => void handleRejectOpponent()}
                      >
                        Enviar rechazo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : !formEditable ? (
              <p className="text-center text-sm text-muted-foreground">
                {!participant
                  ? 'No participas en este partido.'
                  : match.status === 'score_submitted' && currentUserId === match.player_a_user_id
                    ? 'Enviaste el marcador. Espera a que tu rival lo revise.'
                    : match.status === 'player_confirmed'
                      ? 'El rival aceptó el marcador. Un administrador cerrará el resultado oficialmente.'
                      : 'No puedes editar el marcador en este estado.'}
              </p>
            ) : (
              <Button
                type="submit"
                size="lg"
                className="h-12 w-full text-base font-semibold shadow-sm"
                disabled={form.formState.isSubmitting}
              >
                {match.status === 'score_disputed' ? 'Guardar y reenviar a tu rival' : 'Enviar marcador a tu rival'}
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
