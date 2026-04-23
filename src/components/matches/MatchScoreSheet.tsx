import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { Minus, Plus } from 'lucide-react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { canEditMatchAsAdmin, canEditMatchAsPlayer } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'
import { formatScoreCompact, invertScoreSets } from '@/utils/score'

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
  sets: z.array(setSchema).min(1),
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
}) {
  const { open, onOpenChange, match, players, rules, currentUserId, isAdmin, onSave } =
    props

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

  if (!match || !rules) return null

  const bestOf = rules.best_of_sets ?? 3
  const { a: nameA, b: nameB } = namesForMatch(match, players)
  const participant =
    currentUserId === match.player_a_user_id ||
    currentUserId === match.player_b_user_id

  const editable =
    canEditMatchAsAdmin(isAdmin) ||
    canEditMatchAsPlayer({
      match,
      isParticipant: participant,
      allowPlayerScoreEntry: rules.allow_player_score_entry,
    })

  const watched = form.watch('sets')
  const preview = formatScoreCompact(invertScoreSets(watched ?? []))

  const submit = form.handleSubmit(async (values) => {
    await onSave(values.sets)
    onOpenChange(false)
  })

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
            <SheetDescription className="line-clamp-2 text-balance sm:text-sm">
              Mejor de {bestOf} sets · Ajusta los games por set. Los nombres se muestran arriba una
              sola vez.
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-3 sm:px-5">
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
                  aria-label="Juegos por set"
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
                    {fields.map((field, index) => (
                      <tr key={field.id} className="align-middle">
                        <th
                          scope="row"
                          className="pr-1 text-center text-sm font-semibold text-foreground sm:text-base"
                        >
                          {index + 1}
                        </th>
                        <td className="px-1.5 py-1.5">
                          <div className="flex justify-center">
                            <Label className="sr-only" htmlFor={`set-${index}-a`}>
                              {`${nameA}, set ${index + 1}`}
                            </Label>
                            <Input
                              id={`set-${index}-a`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              disabled={!editable}
                              className={scoreInputClass}
                              {...form.register(`sets.${index}.a`, { valueAsNumber: true })}
                            />
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5">
                          <div className="flex justify-center">
                            <Label className="sr-only" htmlFor={`set-${index}-b`}>
                              {`${nameB}, set ${index + 1}`}
                            </Label>
                            <Input
                              id={`set-${index}-b`}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              disabled={!editable}
                              className={scoreInputClass}
                              {...form.register(`sets.${index}.b`, { valueAsNumber: true })}
                            />
                          </div>
                        </td>
                        <td className="py-1.5 pl-1 text-right">
                          {editable ? (
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {editable && fields.length < bestOf ? (
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
                  {match?.status === 'result_submitted' ? (
                    <>
                      Puedes <span className="font-medium text-foreground">corregir</span> el
                      marcador mientras un administrador no lo haya confirmado. Cumple el formato
                      del torneo; tras la hora de fin puedes reenviar.
                    </>
                  ) : (
                    <>
                      Al guardar, el partido pasa a{' '}
                      <span className="font-medium text-foreground">resultado enviado</span>. Solo
                      tras la hora de fin y con marcador válido.
                    </>
                  )}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Al guardar fijas el partido como{' '}
                  <span className="font-medium text-foreground">confirmed</span> o{' '}
                  <span className="font-medium text-foreground">corrected</span> según
                  corresponda.
                </p>
              )}
            </div>
          </div>

          <div
            className="shrink-0 border-t border-border/80 bg-background/90 px-4 py-3 backdrop-blur-sm sm:px-5"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {!editable ? (
              <p className="text-center text-sm text-muted-foreground">
                No tienes permiso para editar este resultado.
              </p>
            ) : (
              <Button
                type="submit"
                size="lg"
                className="h-12 w-full text-base font-semibold shadow-sm"
                disabled={form.formState.isSubmitting}
              >
                Guardar marcador
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
