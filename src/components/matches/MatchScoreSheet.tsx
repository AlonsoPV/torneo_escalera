import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useFieldArray, useForm, type Resolver } from 'react-hook-form'
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
import { resolveViewerGroupPlayerId } from '@/lib/matchUserPerspective'
import { canEditMatchAsAdmin } from '@/lib/permissions'
import { scoreSideNumericInputHandlers } from '@/lib/scoreSideNumericInput'
import { isSuddenDeathRowIndex, maxSetsFromRules } from '@/lib/tournamentRulesEngine'
import { cn } from '@/lib/utils'
import { respondOpponentMatchScore } from '@/services/matches'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'
import {
  formatScoreCompact,
  invertScoreSets,
  setsWonForA,
  setsWonForB,
  validateSuddenDeathMatchScore,
  validateScoreWithRules,
} from '@/utils/score'

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
            message: 'Un set no puede terminar empatado; indica un ganador del set.',
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

/** Quien envió el marcador pendiente de revisión (o Jugador A en filas legacy sin firma). */
function submitterDisplayName(match: MatchRow, players: GroupPlayer[]) {
  const uid = match.score_submitted_by ?? match.player_a_user_id
  const gp = players.find((p) => p.user_id === uid)
  return gp?.display_name ?? 'Tu rival'
}

/** Columna en orden torneo (jugador A / B del cruce). Jugador ve rol + nombre; staff solo nombre. */
type SheetColumnHead =
  | { mode: 'name_only'; display: string }
  | { mode: 'you_rival'; role: 'Tú' | 'Rival'; playerName: string }

function headerLabelsForSheet(params: {
  participant: boolean
  isAdmin: boolean
  viewerGroupPlayerId: string | null
  nameA: string
  nameB: string
  playerAId: string
}): { colA: SheetColumnHead; colB: SheetColumnHead } {
  const { participant, isAdmin, viewerGroupPlayerId, nameA, nameB, playerAId } = params
  if (!participant || isAdmin || !viewerGroupPlayerId) {
    return {
      colA: { mode: 'name_only', display: nameA },
      colB: { mode: 'name_only', display: nameB },
    }
  }
  const isYouA = playerAId === viewerGroupPlayerId
  return {
    colA: { mode: 'you_rival', role: isYouA ? 'Tú' : 'Rival', playerName: nameA },
    colB: { mode: 'you_rival', role: isYouA ? 'Rival' : 'Tú', playerName: nameB },
  }
}

function ScoreSheetBannerCell({ head }: { head: SheetColumnHead }) {
  if (head.mode === 'name_only') {
    return (
      <p className="line-clamp-3 text-center text-sm font-semibold leading-tight text-foreground" title={head.display}>
        {head.display}
      </p>
    )
  }
  return (
    <div className="min-w-0 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-foreground">{head.role}</p>
      <p
        className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-muted-foreground"
        title={head.playerName}
      >
        {head.playerName}
      </p>
    </div>
  )
}

function ScoreSheetTableHeadCell({ head }: { head: SheetColumnHead }) {
  if (head.mode === 'name_only') {
    return (
      <span className="mx-auto block max-w-full truncate text-[10px] font-bold uppercase sm:text-xs">
        {shortLabel(head.display)}
      </span>
    )
  }
  return (
    <div className="mx-auto min-w-0 max-w-full px-0.5 text-center leading-tight">
      <span className="block text-[10px] font-bold uppercase text-muted-foreground sm:text-xs">{head.role}</span>
      <span className="mt-0.5 block truncate text-[10px] font-semibold normal-case text-foreground sm:text-[11px]">
        {shortLabel(head.playerName, 14)}
      </span>
    </div>
  )
}

function srOnlyCanonCellLabel(
  head: SheetColumnHead,
  canonSlotName: string,
  sudden: boolean,
  setIndex: number,
  rules: TournamentRules,
) {
  const detail = sudden
    ? rules.final_set_format === 'super_tiebreak'
      ? '1-0 (super tie-break registrado sin puntos)'
      : '1-0 (muerte súbita registrada sin puntos)'
    : `games · set ${setIndex + 1}`
  if (head.mode === 'name_only') {
    return `${head.display} (${canonSlotName}), ${detail}`
  }
  return `${head.role}, ${head.playerName} (${canonSlotName}), ${detail}`
}

/** Repite Tú/Rival + nombre bajo la casilla (jugador); útil al desplazar la tabla. */
function SheetCellLegendUnderInput({ head, show }: { head: SheetColumnHead; show: boolean }) {
  if (!show || head.mode !== 'you_rival') return null
  return (
    <p className="mt-1 max-w-[5.5rem] text-center text-[9px] leading-tight text-muted-foreground sm:max-w-[6rem]">
      <span className="font-bold uppercase tracking-wide text-foreground">{head.role}</span>
      <span className="mt-px block truncate" title={head.playerName}>
        {head.playerName}
      </span>
    </p>
  )
}
function shortLabel(name: string, max = 12) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const w = parts[0] ?? name
  if (w.length <= max) return w
  return `${w.slice(0, max - 1)}…`
}

/** Cabeceras cortas solo para modo nombre-only genérico (staff). */
function tableHeaderDisplay(display: string, max = 12) {
  return shortLabel(display, max)
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
      match.game_type === 'sudden_death'
        ? {
            sets:
              match.score_raw?.length === 3
                ? match.score_raw.map((s) => ({ a: s.a, b: s.b }))
                : [
                    { a: 0, b: 0 },
                    { a: 0, b: 0 },
                    { a: 0, b: 0 },
                  ],
          }
        : match.score_raw && match.score_raw.length > 0
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

  const isSuddenDeathMatch = match.game_type === 'sudden_death'
  const maxSetsFromTournament = maxSetsFromRules(rules)
  const effectiveMaxSets = isSuddenDeathMatch ? 3 : maxSetsFromTournament
  const hasPointsDecider =
    isSuddenDeathMatch ||
    (maxSetsFromTournament >= 3 &&
      (rules.final_set_format === 'sudden_death' || rules.final_set_format === 'super_tiebreak'))
  const { a: nameA, b: nameB } = namesForMatch(match, players)
  const viewerGpId = resolveViewerGroupPlayerId(match, currentUserId, players)
  const participant =
    Boolean(currentUserId) &&
    (match.player_a_user_id === currentUserId ||
      match.player_b_user_id === currentUserId ||
      viewerGpId != null)

  const hdr = headerLabelsForSheet({
    participant,
    isAdmin,
    viewerGroupPlayerId: viewerGpId,
    nameA,
    nameB,
    playerAId: match.player_a_id,
  })
  const playerPerspectiveUi = Boolean(participant && !isAdmin && viewerGpId)

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
  const watchedList = watched ?? []
  const sheetYouAreA = viewerGpId != null && match.player_a_id === viewerGpId
  const sheetYourName = sheetYouAreA ? nameA : nameB
  const sheetRivalName = sheetYouAreA ? nameB : nameA

  const viewerWatchedSets =
    playerPerspectiveUi && viewerGpId && watchedList.length > 0
      ? sheetYouAreA
        ? watchedList
        : invertScoreSets(watchedList)
      : null

  const previewPrimary =
    playerPerspectiveUi && viewerWatchedSets && viewerWatchedSets.length > 0
      ? formatScoreCompact(viewerWatchedSets)
      : formatScoreCompact(watchedList)

  const previewRivalFirst =
    playerPerspectiveUi && viewerWatchedSets && viewerWatchedSets.length > 0
      ? formatScoreCompact(invertScoreSets(viewerWatchedSets))
      : null

  const previewAdminBFirst =
    !playerPerspectiveUi && watchedList.length > 0
      ? formatScoreCompact(invertScoreSets(watchedList))
      : null

  const sdPreview =
    isSuddenDeathMatch && watchedList.length >= 3
      ? validateSuddenDeathMatchScore(watchedList.slice(0, 3), rules)
      : null
  const sheetPreviewRulesOk = isSuddenDeathMatch
    ? Boolean(sdPreview?.ok)
    : watchedList.length > 0
      ? validateScoreWithRules(watchedList, rules).ok
      : false

  const setsNeeded = Math.floor(rules.best_of_sets / 2) + 1
  const sheetWinnerSide =
    isSuddenDeathMatch && sdPreview?.ok && sdPreview.winner
      ? sdPreview.winner
      : !isSuddenDeathMatch && sheetPreviewRulesOk && watchedList.length > 0
        ? setsWonForA(watchedList) >= setsNeeded
          ? ('a' as const)
          : setsWonForB(watchedList) >= setsNeeded
            ? ('b' as const)
            : null
        : null

  const sheetWinnerIsYou =
    sheetWinnerSide === 'a' ? sheetYouAreA : sheetWinnerSide === 'b' ? !sheetYouAreA : false

  const marcadorGanadorSheetPlayer =
    playerPerspectiveUi && sheetWinnerSide != null && previewRivalFirst
      ? sheetWinnerIsYou
        ? previewPrimary
        : previewRivalFirst
      : null
  const marcadorPerdedorSheetPlayer =
    playerPerspectiveUi && sheetWinnerSide != null && previewRivalFirst
      ? sheetWinnerIsYou
        ? previewRivalFirst
        : previewPrimary
      : null

  const marcadorGanadorSheetAdmin =
    !playerPerspectiveUi && sheetWinnerSide === 'a'
      ? previewPrimary
      : !playerPerspectiveUi && sheetWinnerSide === 'b'
        ? previewAdminBFirst
        : null
  const marcadorPerdedorSheetAdmin =
    !playerPerspectiveUi && sheetWinnerSide === 'a'
      ? previewAdminBFirst
      : !playerPerspectiveUi && sheetWinnerSide === 'b'
        ? previewPrimary
        : null

  const nombreGanadorSheet =
    sheetWinnerSide === 'a' ? nameA : sheetWinnerSide === 'b' ? nameB : null
  const nombrePerdedorSheet =
    sheetWinnerSide === 'a' ? nameB : sheetWinnerSide === 'b' ? nameA : null

  const submit = form.handleSubmit(async (values) => {
    const v = isSuddenDeathMatch
      ? validateSuddenDeathMatchScore(values.sets.slice(0, 3), rules)
      : validateScoreWithRules(values.sets, rules)
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

  const handleRejectOpponent = async () => {
    const reason = rejectReason.trim()
    if (reason.length < 3) {
      toast.error('Escribe el motivo de la refutación (mín. 3 caracteres).')
      return
    }
    setResponding(true)
    try {
      await respondOpponentMatchScore({ matchId: match.id, accept: false, disputeReason: reason })
      toast.message('Resultado refutado', {
        description: 'Organización revisará el marcador y podrá validarlo o corregirlo.',
      })
      setRejectOpen(false)
      setRejectReason('')
      await flowAfter()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar la refutación')
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
                `${submitterDisplayName(match, players)} registró el marcador; ya es oficial para la tabla del grupo. Solo puedes refutarlo aquí si no coincide (no puedes editar los números directamente).`
              ) : (
                <>
                  {isAdmin
                    ? `Como staff puedes ajustar el marcador. Al guardar se cierra oficialmente el partido (ranking).`
                    : isSuddenDeathMatch
                      ? `Este partido es muerte súbita: captura 3 sets; los dos primeros como marcador del set y el tercero decide el partido. El ganador del encuentro es quien gana el set 3.`
                      : hasPointsDecider
                        ? `Introduce hasta ${effectiveMaxSets} sets; los primeros van por games y el decisivo por puntos si aplica. Envía el marcador cuando el partido haya terminado.`
                        : `Introduce games por set (hasta ${effectiveMaxSets} sets). Envía el marcador cuando el partido haya terminado.`}{' '}
                  Cada set debe tener ganador: no se permiten marcadores empatados (p. ej. 6-6 no es un resultado final válido).
                  {!isAdmin && playerPerspectiveUi ? (
                    <>
                      {' '}
                      En la tabla verás <span className="font-medium text-foreground">Tú</span> y{' '}
                      <span className="font-medium text-foreground">Rival</span>; los valores se guardan siempre como jugador
                      A y B del torneo.
                    </>
                  ) : null}
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
                  Motivo de la refutación del rival
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
                <ScoreSheetBannerCell head={hdr.colA} />
                <span className="shrink-0 px-0.5 pb-2.5 text-[10px] font-bold uppercase text-muted-foreground">
                  vs
                </span>
                <ScoreSheetBannerCell head={hdr.colB} />
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
                        className="px-1 pb-2 text-center text-muted-foreground sm:px-1.5"
                        title={
                          hdr.colA.mode === 'you_rival'
                            ? `${hdr.colA.role} · ${hdr.colA.playerName}`
                            : nameA
                        }
                      >
                        {hdr.colA.mode === 'name_only' ? (
                          <span className="block truncate text-[10px] font-bold uppercase sm:text-xs">
                            {tableHeaderDisplay(hdr.colA.display)}
                          </span>
                        ) : (
                          <ScoreSheetTableHeadCell head={hdr.colA} />
                        )}
                      </th>
                      <th
                        scope="col"
                        className="px-1 pb-2 text-center text-muted-foreground sm:px-1.5"
                        title={
                          hdr.colB.mode === 'you_rival'
                            ? `${hdr.colB.role} · ${hdr.colB.playerName}`
                            : nameB
                        }
                      >
                        {hdr.colB.mode === 'name_only' ? (
                          <span className="block truncate text-[10px] font-bold uppercase sm:text-xs">
                            {tableHeaderDisplay(hdr.colB.display)}
                          </span>
                        ) : (
                          <ScoreSheetTableHeadCell head={hdr.colB} />
                        )}
                      </th>
                      <th className="w-12 pb-2" aria-label="Quitar set">
                        <span className="sr-only">Quitar</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const sudden =
                        isSuddenDeathMatch ? index === 2 : isSuddenDeathRowIndex(index, rules)
                      const gameCellMax = sudden ? 1 : 7
                      const rowLabel =
                        isSuddenDeathMatch && index === 2
                          ? `${index + 1} / MS`
                          : sudden
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
                              ? 'Set decisivo: super tie-break (se registra 1-0)'
                              : 'Set decisivo: muerte súbita (se registra 1-0)'
                              : undefined
                          }
                        >
                          {rowLabel}
                        </th>
                        <td className="px-1.5 py-1.5 align-top">
                          <div className="flex flex-col items-center">
                            <div className="flex justify-center">
                              <Label className="sr-only" htmlFor={`set-${index}-a`}>
                                {srOnlyCanonCellLabel(hdr.colA, 'jugador A del cruce', sudden, index, rules)}
                              </Label>
                              <Controller
                                control={form.control}
                                name={`sets.${index}.a`}
                                render={({ field }) => (
                                  <Input
                                    id={`set-${index}-a`}
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    disabled={!formEditable}
                                    className={scoreInputClass}
                                    name={field.name}
                                    ref={field.ref}
                                    onBlur={field.onBlur}
                                    {...scoreSideNumericInputHandlers(Number(field.value) || 0, (n) => field.onChange(n), {
                                      max: gameCellMax,
                                    })}
                                  />
                                )}
                              />
                            </div>
                            <SheetCellLegendUnderInput head={hdr.colA} show={playerPerspectiveUi} />
                          </div>
                        </td>
                        <td className="px-1.5 py-1.5 align-top">
                          <div className="flex flex-col items-center">
                            <div className="flex justify-center">
                              <Label className="sr-only" htmlFor={`set-${index}-b`}>
                                {srOnlyCanonCellLabel(hdr.colB, 'jugador B del cruce', sudden, index, rules)}
                              </Label>
                              <Controller
                                control={form.control}
                                name={`sets.${index}.b`}
                                render={({ field }) => (
                                  <Input
                                    id={`set-${index}-b`}
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    disabled={!formEditable}
                                    className={scoreInputClass}
                                    name={field.name}
                                    ref={field.ref}
                                    onBlur={field.onBlur}
                                    {...scoreSideNumericInputHandlers(Number(field.value) || 0, (n) => field.onChange(n), {
                                      max: gameCellMax,
                                    })}
                                  />
                                )}
                              />
                            </div>
                            <SheetCellLegendUnderInput head={hdr.colB} show={playerPerspectiveUi} />
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

            {formEditable && fields.length < effectiveMaxSets ? (
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
                {playerPerspectiveUi ? 'Dos lecturas del mismo marcador' : 'Marcador · dos órdenes'}
              </p>

              {marcadorGanadorSheetPlayer != null &&
              marcadorPerdedorSheetPlayer != null &&
              nombreGanadorSheet &&
              nombrePerdedorSheet ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-emerald-600/15 bg-emerald-50/70 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase text-emerald-900/85">Marcador ganador</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-950">
                      {marcadorGanadorSheetPlayer}
                    </p>
                    <p className="text-[11px] text-emerald-900/75">{nombreGanadorSheet}</p>
                  </div>
                  <div className="rounded-lg border border-slate-300/60 bg-slate-50 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase text-slate-600">Marcador perdedor</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900">
                      {marcadorPerdedorSheetPlayer}
                    </p>
                    <p className="text-[11px] text-slate-600">{nombrePerdedorSheet}</p>
                  </div>
                </div>
              ) : playerPerspectiveUi && viewerWatchedSets && viewerWatchedSets.length > 0 && previewRivalFirst ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-emerald-600/15 bg-emerald-50/70 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase text-emerald-900/85">Tú · tu número primero</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-950">{previewPrimary}</p>
                    <p className="text-[11px] text-emerald-900/75">{sheetYourName}</p>
                  </div>
                  <div className="rounded-lg border border-slate-300/60 bg-slate-50 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase text-slate-600">Rival · su número primero</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900">{previewRivalFirst}</p>
                    <p className="text-[11px] text-slate-600">{sheetRivalName}</p>
                  </div>
                </div>
              ) : marcadorGanadorSheetAdmin != null &&
                marcadorPerdedorSheetAdmin != null &&
                nombreGanadorSheet &&
                nombrePerdedorSheet ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-emerald-600/15 bg-emerald-50/70 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase text-emerald-900/85">Marcador ganador</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-950">
                      {marcadorGanadorSheetAdmin}
                    </p>
                    <p className="text-[11px] text-emerald-900/75">{nombreGanadorSheet}</p>
                  </div>
                  <div className="rounded-lg border border-slate-300/60 bg-slate-50 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase text-slate-600">Marcador perdedor</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900">
                      {marcadorPerdedorSheetAdmin}
                    </p>
                    <p className="text-[11px] text-slate-600">{nombrePerdedorSheet}</p>
                  </div>
                </div>
              ) : !playerPerspectiveUi && watchedList.length > 0 && previewAdminBFirst ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-background/70 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Jugador A primero</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums">{previewPrimary}</p>
                    <p className="text-[11px] text-muted-foreground">{nameA}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/70 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Jugador B primero</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums">{previewAdminBFirst}</p>
                    <p className="text-[11px] text-muted-foreground">{nameB}</p>
                  </div>
                </div>
              ) : (
                <p className="font-mono text-base font-semibold text-foreground">{previewPrimary || '—'}</p>
              )}

              <p className="text-[11px] leading-snug text-muted-foreground">
                {marcadorGanadorSheetPlayer != null && marcadorPerdedorSheetPlayer != null
                  ? 'Mismo partido: en cada pareja, el primer número es siempre del jugador de la tarjeta (ganador o perdedor).'
                  : marcadorGanadorSheetAdmin != null && marcadorPerdedorSheetAdmin != null
                    ? 'Mismo partido: primera lectura con games del ganador primero; la segunda con games del perdedor primero.'
                    : playerPerspectiveUi
                      ? 'Mismo partido: el primer número de cada pareja es quien encabeza la tarjeta.'
                      : 'Mismo resultado; solo cambia si listas primero al jugador A o al B por set.'}
              </p>

              {!isAdmin ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {showOpponentPanel ? (
                    <>Comprueba que el marcador cuadra con lo jugado. Si no estás de acuerdo, refuta con un comentario claro.</>
                  ) : match?.status === 'score_disputed' ? (
                    <>
                      Este marcador está en revisión administrativa. Organización corregirá o validará el resultado; no puedes
                      reenviarlo desde aquí.
                    </>
                  ) : (
                    <>
                      Al guardar, el marcador queda <span className="font-medium text-foreground">oficial</span> para la
                      tabla del grupo; tu rival solo puede refutarlo si no coincide.
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
                {!rejectOpen ? (
                  <>
                    <Button
                      type="button"
                      size="lg"
                      className="h-12 w-full text-base font-semibold shadow-sm"
                      variant="outline"
                      disabled={responding}
                      onClick={() => setRejectOpen(true)}
                    >
                      Refutar resultado…
                    </Button>
                    <p className="text-center text-xs leading-snug text-muted-foreground">
                      Si el marcador coincide con lo jugado, no necesitas hacer nada más aquí.
                    </p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="dispute-reason" className="text-sm">
                      Motivo de la refutación (obligatorio)
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
                        Enviar refutación
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : !formEditable ? (
              <p className="text-center text-sm text-muted-foreground">
                {!participant
                  ? 'No participas en este partido.'
                  : (match.status === 'closed' || match.status === 'validated') &&
                      match.score_submitted_by != null &&
                      currentUserId === match.score_submitted_by
                    ? match.status === 'validated'
                      ? 'Registraste el marcador y fue validado por organización para la tabla.'
                      : 'Registraste el marcador oficial para la tabla. Tu rival solo puede refutarlo si no coincide.'
                    : match.status === 'closed' || match.status === 'validated'
                      ? match.status === 'validated'
                        ? 'Marcador validado por organización. Ya no puede refutarse desde la app.'
                        : 'Marcador oficial. Solo puedes refutar desde esta pantalla si no coincide.'
                      : match.status === 'score_submitted' &&
                          match.score_submitted_by != null &&
                          currentUserId === match.score_submitted_by
                        ? 'Registraste el marcador confirmado para la tabla. Tu rival solo puede refutarlo si no coincide.'
                        : match.status === 'score_submitted' &&
                            match.score_submitted_by == null &&
                            currentUserId === match.player_a_user_id
                          ? 'Registraste el marcador confirmado para la tabla. Tu rival solo puede refutarlo si no coincide.'
                          : match.status === 'player_confirmed'
                            ? 'Sin refutaciones: un administrador cerrará el resultado oficialmente.'
                            : 'No puedes editar el marcador en este estado.'}
              </p>
            ) : (
              <Button
                type="submit"
                size="lg"
                className="h-12 w-full text-base font-semibold shadow-sm"
                disabled={form.formState.isSubmitting}
              >
                {match.status === 'score_disputed'
                  ? 'Guardar corrección (admin)'
                  : 'Enviar marcador (oficial)'}
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
