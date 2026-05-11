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
  { value: 'sudden_death', label: 'Muerte súbita', description: 'Solo selecciona el jugador ganador.' },
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

function playerName(side: ScoreWinnerSide | null, names: { a: string; b: string }) {
  if (side === 'a') return names.a
  if (side === 'b') return names.b
  return 'Aún no definido'
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {gameTypeOptions.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                'rounded-2xl border p-3 text-left transition',
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

function PlayersHeader({ names }: { names: { a: string; b: string } }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3">
      <p className="min-w-0 truncate text-center text-sm font-semibold text-foreground">{names.a}</p>
      <span className="text-xs font-semibold uppercase text-muted-foreground">vs</span>
      <p className="min-w-0 truncate text-center text-sm font-semibold text-foreground">{names.b}</p>
    </div>
  )
}

function ScoreInputs({
  gameType,
  sets,
  names,
  winner,
  onSetValue,
  onWinnerChange,
}: {
  gameType: MatchGameType
  sets: ScoreSet[]
  names: { a: string; b: string }
  winner: ScoreWinnerSide | null
  onSetValue: (index: number, side: keyof ScoreSet, value: string) => void
  onWinnerChange: (winner: ScoreWinnerSide) => void
}) {
  if (gameType === 'sudden_death') {
    return (
      <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-3">
        <div>
          <p className="text-sm font-bold text-foreground">¿Quién ganó la muerte súbita?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            En muerte súbita solo se registra el ganador del partido.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['a', 'b'] as const).map((side) => {
            const selected = winner === side
            return (
              <button
                key={side}
                type="button"
                className={cn(
                  'rounded-2xl border p-4 text-left transition',
                  selected ? 'border-[#1F5A4C] bg-[#1F5A4C]/8' : 'border-border/70 bg-white hover:bg-muted/30',
                )}
                onClick={() => onWinnerChange(side)}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full border',
                      selected ? 'border-[#1F5A4C] bg-[#1F5A4C] text-white' : 'border-muted-foreground/40',
                    )}
                  >
                    {selected ? <Check className="size-3.5" /> : null}
                  </span>
                  {names[side]} ganó
                </span>
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  const visibleSets = gameType === 'long_set' ? sets.slice(0, 1) : sets

  return (
    <section className="space-y-3">
      {gameType === 'long_set' ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          Set largo: gana quien supera al rival por diferencia de 2 games. No hay límite máximo de juegos.
        </p>
      ) : null}
      {visibleSets.map((set, index) => (
        <div key={index} className="space-y-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
          <div>
            <p className="text-sm font-bold leading-snug text-foreground">
              {gameType === 'long_set' ? 'Set largo' : `Set ${index + 1}`}
            </p>
            <p className="text-xs leading-snug text-muted-foreground">Captura los games de cada jugador.</p>
          </div>
          <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="min-w-0 rounded-xl border border-border/50 bg-muted/20 p-2.5">
              <Label htmlFor={`score-${index}-a`} className="block text-pretty text-[11px] leading-snug text-muted-foreground">
                {names.a}
              </Label>
              <Input
                id={`score-${index}-a`}
                type="number"
                inputMode="numeric"
                min={0}
                className="mt-1.5 h-12 w-full min-w-0 text-center text-xl font-bold tabular-nums"
                value={set.a}
                onChange={(event) => onSetValue(index, 'a', event.target.value)}
              />
            </div>
            <span className="pb-5 text-lg font-bold text-muted-foreground">-</span>
            <div className="min-w-0 rounded-xl border border-border/50 bg-muted/20 p-2.5">
              <Label htmlFor={`score-${index}-b`} className="block text-pretty text-[11px] leading-snug text-muted-foreground">
                {names.b}
              </Label>
              <Input
                id={`score-${index}-b`}
                type="number"
                inputMode="numeric"
                min={0}
                className="mt-1.5 h-12 w-full min-w-0 text-center text-xl font-bold tabular-nums"
                value={set.b}
                onChange={(event) => onSetValue(index, 'b', event.target.value)}
              />
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}

export function ScoreSubmissionModal({
  open,
  onOpenChange,
  match,
  players,
  rules,
  submitting,
  submitLabel = 'Enviar marcador',
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: MatchRow | null
  players: GroupPlayer[]
  rules: TournamentRules | null
  submitting?: boolean
  submitLabel?: string
  onSubmit: (payload: ScorePayload) => Promise<void>
}) {
  const [gameType, setGameType] = useState<MatchGameType>('best_of_3')
  const [sets, setSets] = useState<ScoreSet[]>([{ a: 0, b: 0 }, { a: 0, b: 0 }])
  const [suddenWinner, setSuddenWinner] = useState<ScoreWinnerSide | null>(null)

  useEffect(() => {
    if (!open || !match) return
    const nextType = match.game_type ?? 'best_of_3'
    setGameType(nextType)
    setSuddenWinner(nextType === 'sudden_death'
      ? match.winner_id === match.player_b_id ? 'b' : match.winner_id === match.player_a_id ? 'a' : null
      : null)
    setSets(match.score_raw?.length ? match.score_raw.map(normalizeSet) : [{ a: 0, b: 0 }, { a: 0, b: 0 }])
  }, [match, open])

  const names = useMemo(() => (match ? namesForMatch(match, players) : { a: 'Jugador A', b: 'Jugador B' }), [match, players])

  const normalizedSets = sets.map(normalizeSet)
  const bestOf3Sets = shouldShowThirdSet(normalizedSets.slice(0, 2))
    ? normalizedSets.slice(0, 3)
    : normalizedSets.slice(0, 2)
  const validation = (() => {
    if (gameType === 'best_of_3') return validateBestOf3Score(bestOf3Sets)
    if (gameType === 'long_set') return validateLongSetScore(normalizedSets[0])
    return validateSuddenDeathScore({ game_type: gameType, winner: suddenWinner })
  })()
  const winner = validation.winner
  const scoreForPayload = gameType === 'best_of_3' ? bestOf3Sets : [normalizedSets[0]]
  const scoreLabel =
    gameType === 'sudden_death'
      ? 'por muerte súbita'
      : formatScoreCompact(scoreForPayload)
  const mirrorPreview =
    gameType === 'sudden_death'
      ? winner === 'a' ? `${names.b}: perdió muerte súbita` : winner === 'b' ? `${names.a}: perdió muerte súbita` : '—'
      : formatScoreCompact(invertScoreSets(scoreForPayload))
  const decidedInTwo = gameType === 'best_of_3' && bestOf3Sets.length === 2 && validation.ok

  const setValue = (index: number, side: keyof ScoreSet, value: string) => {
    const next = [...sets]
    next[index] = { ...(next[index] ?? { a: 0, b: 0 }), [side]: Math.max(0, Number(value) || 0) }
    if (index === 1 && !shouldShowThirdSet(next.slice(0, 2))) {
      next.splice(2)
    }
    setSets(next)
  }

  const changeGameType = (nextType: MatchGameType) => {
    if (nextType === gameType) return
    toast.message('Cambiar el tipo de juego limpiará el marcador actual.')
    setGameType(nextType)
    setSuddenWinner(null)
    setSets(nextType === 'long_set' ? [{ a: 0, b: 0 }] : [{ a: 0, b: 0 }, { a: 0, b: 0 }])
  }

  const handleSubmit = async () => {
    if (!validation.ok || !winner) {
      toast.error(validation.errors[0] ?? 'Marcador inválido')
      return
    }
    const payload: ScorePayload =
      gameType === 'sudden_death'
        ? { game_type: 'sudden_death', score_json: null, winner }
        : gameType === 'long_set'
          ? { game_type: 'long_set', score_json: [scoreForPayload[0] ?? { a: 0, b: 0 }], winner }
          : { game_type: 'best_of_3', score_json: scoreForPayload, winner }
    await onSubmit(payload)
  }

  if (!match || !rules) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,46rem)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/70 px-4 pb-3 pt-5 sm:px-5">
          <DialogTitle className="text-lg">Registrar marcador</DialogTitle>
          <DialogDescription>
            Elige el tipo de juego y captura solo la información necesaria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <GameTypeSelector value={gameType} onChange={changeGameType} />
          <PlayersHeader names={names} />
          <ScoreInputs
            gameType={gameType}
            sets={gameType === 'best_of_3' && shouldShowThirdSet(normalizedSets.slice(0, 2)) && sets.length < 3
              ? [...sets, { a: 0, b: 0 }]
              : sets}
            names={names}
            winner={suddenWinner}
            onSetValue={setValue}
            onWinnerChange={setSuddenWinner}
          />

          {decidedInTwo ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
              El partido ya se definió en 2 sets.
            </p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Vista previa</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {winner ? `${playerName(winner, names)} gana ${scoreLabel}` : 'Aún no hay ganador definido'}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Vista del rival</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">{mirrorPreview}</p>
            </div>
          </div>

          {!validation.ok ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="size-4" />
                Hay un detalle en el marcador
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-red-700">Corrige el bloque antes de enviarlo.</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {validation.errors.slice(0, 3).map((error) => (
                  <li key={error}>{error}</li>
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

        <DialogFooter className="flex-col-reverse gap-2 px-4 sm:flex-row sm:px-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={submitting || !validation.ok} onClick={handleSubmit}>
            {submitting ? 'Enviando…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
