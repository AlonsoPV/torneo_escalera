import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { scoreSideNumericInputHandlers } from '@/lib/scoreSideNumericInput'
import { cn } from '@/lib/utils'
import type { GroupPlayer, MatchGameType, MatchRow, ScorePayload, ScoreSet, ScoreWinnerSide, TournamentRules } from '@/types/database'
import {
  formatScoreCompact,
  invertScoreSets,
  shouldShowThirdSet,
  validateBestOf3Score,
  validateLongSetScore,
  validateSuddenDeathScore,
} from '@/utils/score'

const gameTypeOptions: Array<{ value: MatchGameType; label: string; description: string }> = [
  { value: 'best_of_3', label: '2 de 3 sets', description: 'Gana quien consiga 2 sets.' },
  { value: 'sudden_death', label: 'Muerte súbita', description: 'Tres sets; el tercero (a 7) define al ganador.' },
  { value: 'long_set', label: 'Set largo', description: 'Un solo set sin límite de juegos.' },
]

function namesForMatch(match: MatchRow, players: GroupPlayer[]) {
  return {
    a: players.find((p) => p.id === match.player_a_id)?.display_name ?? 'Jugador A',
    b: players.find((p) => p.id === match.player_b_id)?.display_name ?? 'Jugador B',
  }
}

function normalizeSet(set: ScoreSet): ScoreSet {
  return { a: Math.max(0, Number(set.a) || 0), b: Math.max(0, Number(set.b) || 0) }
}

function GameTypeSelector({
  value,
  onChange,
}: {
  value: MatchGameType
  onChange: (value: MatchGameType) => void
}) {
  return (
    <section className="space-y-2">
      <p className="text-sm font-semibold text-foreground">Tipo de juego</p>
      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:grid-cols-3">
        {gameTypeOptions.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                'min-h-11 touch-manipulation rounded-2xl border p-3 text-left transition active:scale-[0.99] sm:min-h-0',
                selected
                  ? 'border-[#1F5A4C] bg-[#1F5A4C]/8 shadow-sm'
                  : 'border-border/70 bg-white hover:border-[#1F5A4C]/40 hover:bg-muted/30',
              )}
              onClick={() => onChange(option.value)}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-bold text-foreground">{option.label}</span>
                {selected ? (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1F5A4C] text-white">
                    <Check className="size-3.5" />
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.description}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Cabecera: columna izq. = jugador A del torneo, der. = jugador B (orden canónico). */
function PlayersPerspectiveHeader({
  leftHead,
  rightHead,
}: {
  leftHead: { perspective: string; playerName: string }
  rightHead: { perspective: string; playerName: string }
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-2">
      <div className="min-w-0 text-center sm:text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-foreground">{leftHead.perspective}</p>
        <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-muted-foreground sm:truncate" title={leftHead.playerName}>
          {leftHead.playerName}
        </p>
      </div>
      <span className="shrink-0 text-center text-xs font-semibold uppercase text-muted-foreground sm:px-1">vs</span>
      <div className="min-w-0 text-center sm:text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-foreground">{rightHead.perspective}</p>
        <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-muted-foreground sm:truncate" title={rightHead.playerName}>
          {rightHead.playerName}
        </p>
      </div>
    </div>
  )
}

function ColumnFieldLegend({
  perspective,
  playerName,
  htmlFor,
}: {
  perspective: string
  playerName: string
  htmlFor: string
}) {
  return (
    <Label htmlFor={htmlFor} className="mb-0 block min-h-[2rem] space-y-0.5 text-left sm:min-h-[2.25rem]">
      <span className="block text-xs font-bold uppercase tracking-wide text-foreground">{perspective}</span>
      <span className="block line-clamp-2 text-[11px] font-medium leading-snug text-muted-foreground sm:truncate" title={playerName}>
        {playerName}
      </span>
    </Label>
  )
}

function ScoreInputs({
  gameType,
  sets,
  columnHints,
  onSetValue,
}: {
  gameType: MatchGameType
  sets: ScoreSet[]
  columnHints: { a: { perspective: string; playerName: string }; b: { perspective: string; playerName: string } }
  onSetValue: (index: number, side: keyof ScoreSet, value: string) => void
}) {
  const visibleSets =
    gameType === 'long_set'
      ? sets.slice(0, 1)
      : gameType === 'sudden_death'
        ? sets.slice(0, 3)
        : sets

  return (
    <section className="space-y-3">
      {gameType === 'long_set' ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          Set largo: introduce el marcador completo del set (sin empates). No hay límite máximo de juegos en la captura.
        </p>
      ) : null}
      {gameType === 'sudden_death' ? (
        <p className="rounded-xl border border-border/60 bg-muted/25 p-3 text-xs leading-relaxed text-muted-foreground">
          Captura el marcador completo. El <span className="font-semibold text-foreground">tercer set</span> define al
          ganador del partido. No uses empates en ningún set.
        </p>
      ) : null}
      {visibleSets.map((set, index) => {
        const isSdThird = gameType === 'sudden_death' && index === 2
        const setTitle =
          gameType === 'long_set'
            ? 'Set largo'
            : gameType === 'sudden_death' && index === 2
              ? 'Set 3 · Muerte súbita a 7'
              : `Set ${index + 1}`
        return (
        <div key={index} className="space-y-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:p-3.5">
          <div>
            <p className="text-sm font-bold leading-snug text-foreground">{setTitle}</p>
            <p className="text-xs leading-snug text-muted-foreground">
              {isSdThird ? (
                <>Introduce el marcador del set decisivo; debe haber un ganador (sin empates).</>
              ) : (
                <>
                  Cada casilla indica si eres <span className="font-medium text-foreground">Tú</span> o{' '}
                  <span className="font-medium text-foreground">Rival</span> y el nombre en el torneo (jugador A/B del cruce).
                </>
              )}
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 min-[400px]:grid-cols-[1fr_auto_1fr] min-[400px]:items-start min-[400px]:gap-2">
            <div className="min-w-0 rounded-xl border border-border/50 bg-muted/20 p-2.5 sm:p-3">
              <ColumnFieldLegend
                perspective={columnHints.a.perspective}
                playerName={columnHints.a.playerName}
                htmlFor={`score-${index}-a`}
              />
              <Input
                id={`score-${index}-a`}
                type="number"
                inputMode="numeric"
                min={0}
                className="mt-1.5 h-12 min-h-12 w-full min-w-0 text-center text-xl font-bold tabular-nums sm:text-2xl"
                {...scoreSideNumericInputHandlers(set.a, (n) =>
                  onSetValue(index, 'a', String(n)),
                )}
              />
            </div>
            <span className="hidden min-[400px]:flex min-[400px]:h-12 min-[400px]:items-end min-[400px]:pb-2.5 min-[400px]:text-lg min-[400px]:font-bold min-[400px]:text-muted-foreground">
              -
            </span>
            <div className="-mt-1 flex justify-center min-[400px]:hidden">
              <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-bold text-muted-foreground">vs</span>
            </div>
            <div className="min-w-0 rounded-xl border border-border/50 bg-muted/20 p-2.5 sm:p-3">
              <ColumnFieldLegend
                perspective={columnHints.b.perspective}
                playerName={columnHints.b.playerName}
                htmlFor={`score-${index}-b`}
              />
              <Input
                id={`score-${index}-b`}
                type="number"
                inputMode="numeric"
                min={0}
                className="mt-1.5 h-12 min-h-12 w-full min-w-0 text-center text-xl font-bold tabular-nums sm:text-2xl"
                {...scoreSideNumericInputHandlers(set.b, (n) =>
                  onSetValue(index, 'b', String(n)),
                )}
              />
            </div>
          </div>
        </div>
        )
      })}
    </section>
  )
}

export function ScoreSubmissionModal({
  open,
  onOpenChange,
  match,
  players,
  viewerGroupPlayerId,
  rules,
  submitting,
  submitLabel = 'Enviar marcador',
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: MatchRow | null
  players: GroupPlayer[]
  /** Tu fila en `group_players` para mantener perspectiva «Tú / Rival». */
  viewerGroupPlayerId: string
  rules: TournamentRules | null
  submitting?: boolean
  submitLabel?: string
  onSubmit: (payload: ScorePayload) => Promise<void>
}) {
  const [gameType, setGameType] = useState<MatchGameType>('best_of_3')
  const [sets, setSets] = useState<ScoreSet[]>([{ a: 0, b: 0 }, { a: 0, b: 0 }])

  useEffect(() => {
    if (!open || !match) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincronizar estado local del diálogo con `match` al abrir */
    const nextType = match.game_type ?? 'best_of_3'
    setGameType(nextType)
    if (nextType === 'sudden_death') {
      const raw = match.score_raw
      setSets(raw?.length === 3 ? raw.map(normalizeSet) : [{ a: 0, b: 0 }, { a: 0, b: 0 }, { a: 0, b: 0 }])
    } else {
      setSets(match.score_raw?.length ? match.score_raw.map(normalizeSet) : [{ a: 0, b: 0 }, { a: 0, b: 0 }])
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [match, open])

  const names = useMemo(() => (match ? namesForMatch(match, players) : { a: 'Jugador A', b: 'Jugador B' }), [match, players])

  const isYouA = match != null && match.player_a_id === viewerGroupPlayerId
  const columnHints = {
    a: { perspective: isYouA ? 'Tú' : 'Rival', playerName: names.a },
    b: { perspective: isYouA ? 'Rival' : 'Tú', playerName: names.b },
  } as const

  const normalizedSets = sets.map(normalizeSet)
  const bestOf3Sets = shouldShowThirdSet(normalizedSets.slice(0, 2))
    ? normalizedSets.slice(0, 3)
    : normalizedSets.slice(0, 2)
  const suddenThreeSets = gameType === 'sudden_death' ? normalizedSets.slice(0, 3) : null
  const validation = (() => {
    if (gameType === 'best_of_3') return validateBestOf3Score(bestOf3Sets)
    if (gameType === 'long_set') return validateLongSetScore(normalizedSets[0])
    if (!rules) return { ok: false, errors: ['Sin reglas del torneo.'], winner: null as ScoreWinnerSide | null }
    return validateSuddenDeathScore({
      game_type: 'sudden_death',
      score_json: suddenThreeSets,
      winner: null,
      rules,
    })
  })()
  const winner = validation.winner
  const scoreForPayload =
    gameType === 'best_of_3' ? bestOf3Sets : gameType === 'sudden_death' ? suddenThreeSets ?? [] : [normalizedSets[0]]
  const scoreLabel =
    gameType === 'sudden_death'
      ? suddenThreeSets?.length === 3
        ? formatScoreCompact(suddenThreeSets)
        : 'muerte súbita (3 sets)'
      : formatScoreCompact(scoreForPayload)
  const decidedInTwo = gameType === 'best_of_3' && bestOf3Sets.length === 2 && validation.ok

  const youWon =
    winner != null && ((winner === 'a' && isYouA) || (winner === 'b' && !isYouA))

  const yourName = isYouA ? names.a : names.b
  const rivalName = isYouA ? names.b : names.a

  /** Sets en orden «tú primero» para el resumen legible. */
  const viewerSetsForSummary =
    gameType === 'sudden_death'
      ? suddenThreeSets && suddenThreeSets.length === 3
        ? isYouA
          ? suddenThreeSets
          : invertScoreSets(suddenThreeSets)
        : null
      : isYouA
        ? scoreForPayload
        : invertScoreSets(scoreForPayload)

  const numericYouFirst =
    viewerSetsForSummary && viewerSetsForSummary.length > 0
      ? formatScoreCompact(viewerSetsForSummary)
      : null

  const numericRivalFirst =
    viewerSetsForSummary && viewerSetsForSummary.length > 0
      ? formatScoreCompact(invertScoreSets(viewerSetsForSummary))
      : null

  const marcadorGanadorCompact =
    winner != null && numericYouFirst != null && numericRivalFirst != null
      ? youWon
        ? numericYouFirst
        : numericRivalFirst
      : null
  const marcadorPerdedorCompact =
    winner != null && numericYouFirst != null && numericRivalFirst != null
      ? youWon
        ? numericRivalFirst
        : numericYouFirst
      : null
  const nombreGanadorResumen = winner != null ? (youWon ? yourName : rivalName) : ''
  const nombrePerdedorResumen = winner != null ? (youWon ? rivalName : yourName) : ''

  const setValue = (index: number, side: keyof ScoreSet, value: string) => {
    const next = [...sets]
    let num = Math.max(0, Number(value) || 0)
    if (gameType === 'sudden_death' && index === 2) num = Math.min(7, num)
    next[index] = { ...(next[index] ?? { a: 0, b: 0 }), [side]: num }
    if (gameType === 'best_of_3' && index === 1 && !shouldShowThirdSet(next.slice(0, 2))) {
      next.splice(2)
    }
    setSets(next)
  }

  const changeGameType = (nextType: MatchGameType) => {
    if (nextType === gameType) return
    toast.message('Cambiar el tipo de juego limpiará el marcador actual.')
    setGameType(nextType)
    setSets(
      nextType === 'long_set'
        ? [{ a: 0, b: 0 }]
        : nextType === 'sudden_death'
          ? [
              { a: 0, b: 0 },
              { a: 0, b: 0 },
              { a: 0, b: 0 },
            ]
          : [{ a: 0, b: 0 }, { a: 0, b: 0 }],
    )
  }

  const handleSubmit = async () => {
    if (!validation.ok || !winner) {
      toast.error(validation.errors[0] ?? 'Marcador inválido')
      return
    }
    const payload: ScorePayload =
      gameType === 'sudden_death'
        ? {
            game_type: 'sudden_death',
            score_json: suddenThreeSets ?? [],
            winner,
          }
        : gameType === 'long_set'
          ? { game_type: 'long_set', score_json: [scoreForPayload[0] ?? { a: 0, b: 0 }], winner }
          : { game_type: 'best_of_3', score_json: scoreForPayload, winner }
    await onSubmit(payload)
  }

  const calculatedWinnerName = winner != null ? (winner === 'a' ? names.a : names.b) : null

  if (!match || !rules) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(100dvh-1rem,46rem)] w-[min(100vw-1rem,42rem)] max-w-[min(100vw-1rem,42rem)] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-2 border-b border-border/70 px-4 pb-3 pt-5 pr-12 sm:px-5 sm:pr-14">
          <DialogTitle className="text-base leading-tight sm:text-lg">Registrar marcador</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed sm:text-sm">
            Los números siguen el orden del torneo (jugadores A y B del cruce). En pantalla siempre verás{' '}
            <span className="font-medium text-foreground">Tú</span> y <span className="font-medium text-foreground">Rival</span>{' '}
            en las mismas columnas para que sea fácil revisar antes de enviar.
          </DialogDescription>
          <p className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-muted-foreground ring-1 ring-border/40 sm:text-xs">
            <span className="text-foreground">1.</span> Tipo de partido ·{' '}
            <span className="text-foreground">2.</span> Quién eres en el cruce ·{' '}
            <span className="text-foreground">3.</span> Games por set
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:space-y-6 sm:px-5">
          <GameTypeSelector value={gameType} onChange={changeGameType} />
          <PlayersPerspectiveHeader leftHead={columnHints.a} rightHead={columnHints.b} />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Marcador</p>
            <ScoreInputs
            gameType={gameType}
            sets={
              gameType === 'sudden_death'
                ? sets.slice(0, 3)
                : gameType === 'best_of_3' && shouldShowThirdSet(normalizedSets.slice(0, 2)) && sets.length < 3
                  ? [...sets, { a: 0, b: 0 }]
                  : sets
            }
            columnHints={columnHints}
            onSetValue={setValue}
          />
          </div>

          {gameType === 'sudden_death' && validation.ok && calculatedWinnerName ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-900 break-words">
              Ganador calculado:{' '}
              <span className="text-emerald-950">{calculatedWinnerName}</span>
            </p>
          ) : null}

          {decidedInTwo ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
              El partido ya se definió en 2 sets.
            </p>
          ) : null}

          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Antes de enviar</p>

            {winner == null ? (
              gameType !== 'long_set' && numericYouFirst && numericRivalFirst ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-background/90 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Tu lectura
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-foreground" title={yourName}>
                      {yourName} — tu número va primero
                    </p>
                    <p className="mt-2 font-mono text-xl font-bold tabular-nums text-foreground">{numericYouFirst}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/90 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Lectura del rival
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-foreground" title={rivalName}>
                      {rivalName} — su número va primero
                    </p>
                    <p className="mt-2 font-mono text-xl font-bold tabular-nums text-foreground">{numericRivalFirst}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Completa todos los sets necesarios; aquí verás el mismo marcador en las dos perspectivas.
                </p>
              )
            ) : (
              <>
                <p className="mt-2 text-sm font-semibold leading-snug text-foreground">
                  {youWon ? 'Victoria para ti' : `Victoria para ${rivalName}`}
                  <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">
                    {gameType === 'sudden_death'
                      ? `Marcador en torneo (jug. A vs B): ${scoreLabel}. En muerte súbita cuenta solo el set 3.`
                      : `Marcador en torneo (jug. A vs B): ${scoreLabel}`}
                  </span>
                </p>

                {marcadorGanadorCompact && marcadorPerdedorCompact ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-emerald-600/15 bg-emerald-50/80 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-900/80">
                        Ganador (tu vista)
                      </p>
                      <p className="mt-2 font-mono text-xl font-bold tabular-nums text-emerald-950">
                        {marcadorGanadorCompact}
                      </p>
                      <p className="mt-1 text-xs text-emerald-900/80">{nombreGanadorResumen}</p>
                    </div>
                    <div className="rounded-lg border border-slate-300/60 bg-slate-50 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        Perdedor (tu vista)
                      </p>
                      <p className="mt-2 font-mono text-xl font-bold tabular-nums text-slate-900">
                        {marcadorPerdedorCompact}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{nombrePerdedorResumen}</p>
                    </div>
                  </div>
                ) : null}

                {marcadorGanadorCompact && marcadorPerdedorCompact ? (
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                    Es el mismo resultado: en cada tarjeta el <span className="font-medium text-foreground">primer número</span>{' '}
                    corresponde a la persona indicada en el título de esa tarjeta.
                  </p>
                ) : null}
              </>
            )}
          </div>

          {!validation.ok ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="size-4" />
                Hay un detalle en el marcador
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-red-700">Corrige el bloque antes de enviarlo.</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {validation.errors.slice(0, 3).map((error, index) => (
                  <li key={`validation-${index}`}>{error}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="size-4" />
                Marcador listo para enviar
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 rounded-b-2xl border-t border-border/70 bg-background/95 px-4 pt-3 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))] supports-[backdrop-filter]:bg-background/85 sm:flex-row sm:justify-end sm:px-5">
          <Button type="button" variant="outline" className="w-full min-h-11 touch-manipulation sm:w-auto" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={submitting || !validation.ok} className="w-full min-h-11 touch-manipulation sm:w-auto" onClick={handleSubmit}>
            {submitting ? 'Enviando…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
