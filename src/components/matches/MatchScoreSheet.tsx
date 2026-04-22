import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { canEditMatchAsAdmin, canEditMatchAsPlayer } from '@/lib/permissions'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'
import { formatScoreCompact, invertScoreSets } from '@/utils/score'

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
    defaultValues: { sets: [{ a: 6, b: 4 }] },
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
        : { sets: [{ a: 6, b: 4 }] }
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
      status: match.status,
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
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Marcador</SheetTitle>
          <SheetDescription>
            {nameA} vs {nameB} · Formato al mejor de {bestOf}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={submit}
          className="mt-4 flex flex-1 flex-col gap-4 overflow-y-auto pb-6"
        >
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2">
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{nameA}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      disabled={!editable}
                      {...form.register(`sets.${index}.a`, { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{nameB}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      disabled={!editable}
                      {...form.register(`sets.${index}.b`, { valueAsNumber: true })}
                    />
                  </div>
                </div>
                {editable ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                  >
                    −
                  </Button>
                ) : null}
              </div>
            ))}
          </div>

          {editable && fields.length < bestOf ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => append({ a: 0, b: 0 })}
            >
              Agregar set
            </Button>
          ) : null}

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">Vista inversa</p>
            <p className="text-muted-foreground">{preview}</p>
            {!isAdmin ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Al guardar como jugador, el resultado quedará confirmado y ya no podrás
                editarlo.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Como admin, tus correcciones marcarán el partido como{' '}
                <span className="font-medium">corrected</span> si ya existía marcador.
              </p>
            )}
          </div>

          <SheetFooter className="mt-auto flex-col gap-2 sm:flex-col">
            {!editable ? (
              <p className="text-sm text-muted-foreground">
                No tienes permiso para editar este resultado.
              </p>
            ) : (
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Guardar
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
