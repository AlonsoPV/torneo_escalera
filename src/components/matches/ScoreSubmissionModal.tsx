import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle, Check, CheckCircle2, Flame, Info, Layers, Timer, Trophy, UserX } from 'lucide-react'
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
  validateIncompleteBestOf3Score,
  validateBestOf3Score,
  validateLongSetScore,
  validateSuddenDeathThirdSet,
  getSetWinner,
} from '@/utils/score'

const gameTypeOptions: Array<{
  value: MatchGameType
  label: string
  description: string
  icon: LucideIcon
}> = [
  {
    value: 'best_of_3',
    label: '2 de 3 sets',
    description: 'Gana quien consiga 2 sets; marcador clásico por games.',
    icon: Layers,
  },
  {
    value: 'sudden_death',
    label: 'Muerte súbita',
    description: 'Marca el resultado del set decisivo; ese set define al ganador.',
    icon: Flame,
  },
  {
    value: 'long_set',
    label: 'Set largo',
    description: 'Un solo set; sin techo de juegos en la captura.',
    icon: Timer,
  },
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

type SpecialResultMode = 'normal' | 'retired' | 'wo'
type RetirementActor = ScoreWinnerSide | 'both' | null
type CapturePerspective = 'viewer' | 'rival'

const INFO_HINT_VIEWPORT_MARGIN = 10
const INFO_HINT_GAP = 8
const INFO_HINT_MAX_WIDTH = 240

function InfoHint({
  label,
  children,
  align = 'end',
}: {
  label: string
  children: ReactNode
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties | null>(null)
  const canHover = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    [],
  )

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    const rect = trigger.getBoundingClientRect()
    const { height: tipH } = tooltip.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const maxWidth = Math.min(INFO_HINT_MAX_WIDTH, vw - INFO_HINT_VIEWPORT_MARGIN * 2)

    let top = rect.bottom + INFO_HINT_GAP
    let left = align === 'end' ? rect.right - maxWidth : rect.left
    left = Math.max(INFO_HINT_VIEWPORT_MARGIN, Math.min(left, vw - maxWidth - INFO_HINT_VIEWPORT_MARGIN))

    if (top + tipH > vh - INFO_HINT_VIEWPORT_MARGIN) {
      top = rect.top - INFO_HINT_GAP - tipH
    }
    top = Math.max(INFO_HINT_VIEWPORT_MARGIN, Math.min(top, vh - tipH - INFO_HINT_VIEWPORT_MARGIN))

    setTooltipStyle({
      position: 'fixed',
      top,
      left,
      width: maxWidth,
      zIndex: 120,
    })
  }, [align])

  useLayoutEffect(() => {
    if (!open) {
      setTooltipStyle(null)
      return
    }
    updatePosition()
  }, [open, children, updatePosition])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || tooltipRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const tooltip =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={
              tooltipStyle ?? {
                position: 'fixed',
                top: -9999,
                left: -9999,
                width: INFO_HINT_MAX_WIDTH,
                visibility: 'hidden',
                zIndex: 120,
              }
            }
            className={cn(
              'rounded-lg border border-border/80 bg-popover px-2.5 py-2 text-[11px] leading-snug text-popover-foreground shadow-lg',
              tooltipStyle ? 'visible' : 'invisible',
            )}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {children}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        className="inline-flex size-6 shrink-0 touch-manipulation items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/25"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        onMouseEnter={() => {
          if (canHover) setOpen(true)
        }}
        onMouseLeave={() => {
          if (canHover) setOpen(false)
        }}
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {tooltip}
    </>
  )
}

function GameTypeSelector({
  value,
  onChange,
}: {
  value: MatchGameType
  onChange: (value: MatchGameType) => void
}) {
  return (
    <section className="space-y-2.5 overflow-visible">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-foreground">Tipo de juego</p>
        <InfoHint label="Información sobre el tipo de juego">
          Elige el formato del partido; debe coincidir con lo acordado en pista.
        </InfoHint>
      </div>
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Tipo de juego del partido"
      >
        {gameTypeOptions.map((option) => {
          const selected = value === option.value
          const Icon = option.icon
          return (
            <div
              key={option.value}
              role="radio"
              tabIndex={0}
              aria-checked={selected}
              className={cn(
                'group relative min-h-[3.25rem] cursor-pointer touch-manipulation overflow-visible rounded-xl border-2 px-2.5 py-2 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/25 sm:min-h-[3.5rem] sm:px-3',
                selected
                  ? 'border-[#1F5A4C] bg-[#1F5A4C]/[0.09] shadow-sm ring-2 ring-[#1F5A4C]/15'
                  : 'border-border/60 bg-gradient-to-b from-white to-muted/30 hover:border-[#1F5A4C]/45 hover:bg-muted/40',
              )}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onChange(option.value)
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors sm:size-10',
                    selected
                      ? 'border-[#1F5A4C]/40 bg-[#1F5A4C] text-white'
                      : 'border-border/50 bg-white text-[#1F5A4C]/80 group-hover:border-[#1F5A4C]/35',
                  )}
                >
                  <Icon className="size-4 sm:size-[1.1rem]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold leading-tight text-foreground sm:text-[0.9375rem]">
                  {option.label}
                </span>
                <InfoHint label={`Información: ${option.label}`} align="end">
                  {option.description}
                </InfoHint>
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    selected
                      ? 'border-[#1F5A4C] bg-[#1F5A4C] text-white'
                      : 'border-muted-foreground/35 bg-white',
                  )}
                  aria-hidden
                >
                  {selected ? <Check className="size-3" strokeWidth={2.8} /> : null}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Cabecera del cruce: columna izquierda = quien registra (Tú), derecha = rival. */
function PlayersPerspectiveHeader({
  leftHead,
  rightHead,
}: {
  leftHead: { perspective: string; playerName: string }
  rightHead: { perspective: string; playerName: string }
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-border/60 bg-muted/20 px-2 py-2.5 sm:gap-2 sm:px-3 sm:py-3">
      <div className="min-w-0 px-0.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wide text-foreground sm:text-xs">{leftHead.perspective}</p>
        <p
          className="mt-0.5 line-clamp-2 break-words text-[11px] font-semibold leading-snug text-muted-foreground sm:truncate sm:text-xs"
          title={leftHead.playerName}
        >
          {leftHead.playerName}
        </p>
      </div>
      <span className="shrink-0 px-0.5 text-center text-[10px] font-bold uppercase text-muted-foreground sm:px-1 sm:text-xs">
        vs
      </span>
      <div className="min-w-0 px-0.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wide text-foreground sm:text-xs">{rightHead.perspective}</p>
        <p
          className="mt-0.5 line-clamp-2 break-words text-[11px] font-semibold leading-snug text-muted-foreground sm:truncate sm:text-xs"
          title={rightHead.playerName}
        >
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
    <Label htmlFor={htmlFor} className="mb-0 flex min-h-[2.5rem] flex-col justify-end gap-0.5 text-center min-[400px]:text-left sm:min-h-[2.25rem]">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-foreground sm:text-xs">{perspective}</span>
      <span
        className="block line-clamp-2 break-words text-[10px] font-medium leading-snug text-muted-foreground min-[400px]:line-clamp-1 sm:text-[11px] sm:truncate"
        title={playerName}
      >
        {playerName}
      </span>
    </Label>
  )
}

function ScoreInputs({
  gameType,
  sets,
  columnHints,
  /** Lado canónico (A o B en el cruce) del jugador que envía el marcador; siempre columna izquierda. */
  primaryCanonicalSide,
  onSetValue,
}: {
  gameType: MatchGameType
  sets: ScoreSet[]
  columnHints: { a: { perspective: string; playerName: string }; b: { perspective: string; playerName: string } }
  primaryCanonicalSide: 'a' | 'b'
  onSetValue: (index: number, side: keyof ScoreSet, value: string) => void
}) {
  const leftSide = primaryCanonicalSide
  const rightSide: 'a' | 'b' = primaryCanonicalSide === 'a' ? 'b' : 'a'

  const visibleSets = gameType === 'long_set' || gameType === 'sudden_death' ? sets.slice(0, 1) : sets

  return (
    <section className="space-y-2.5 sm:space-y-3">
      {gameType === 'long_set' ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-800 sm:p-3 sm:text-xs">
          Set largo: introduce el marcador completo del set (sin empates). No hay límite máximo de juegos en la captura.
        </p>
      ) : null}
      {gameType === 'sudden_death' ? (
        <p className="rounded-xl border border-border/60 bg-muted/25 p-2.5 text-[11px] leading-relaxed text-muted-foreground sm:p-3 sm:text-xs">
          Muerte subita: captura el resultado real del set decisivo. No puede quedar empatado.
        </p>
      ) : null}
      {visibleSets.map((set, index) => {
        const setTitle =
          gameType === 'long_set' ? 'Set largo' : gameType === 'sudden_death' ? 'Set decisivo' : `Set ${index + 1}`
        const isBo3DecisiveThird =
          gameType === 'best_of_3' &&
          index === 2 &&
          shouldShowThirdSet(visibleSets.slice(0, 2))

        return (
        <div key={index} className="space-y-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:space-y-3.5 sm:p-4">
          <div className="space-y-1">
            <p className="text-sm font-bold leading-snug text-foreground sm:text-base">{setTitle}</p>
            <p className="text-pretty text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              {isBo3DecisiveThird ? (
                <>
                  Van 1-1 en sets. Captura el marcador del set (p. ej. 6-2 o 1-0 si fue super tie-break).
                </>
              ) : (
                <>
                  Cada casilla indica si eres <span className="font-medium text-foreground">Tú</span> o{' '}
                  <span className="font-medium text-foreground">Rival</span> y el nombre en el torneo (jugador A/B
                  del cruce).
                </>
              )}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-2 sm:p-3">
          <div className="space-y-2 sm:space-y-2.5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-1.5 sm:gap-2">
              <ColumnFieldLegend
                perspective={columnHints[leftSide].perspective}
                playerName={columnHints[leftSide].playerName}
                htmlFor={`score-${index}-${leftSide}`}
              />
              <span className="pointer-events-none select-none pb-1 text-center text-[10px] font-bold uppercase text-transparent sm:pb-1.5">
                ·
              </span>
              <ColumnFieldLegend
                perspective={columnHints[rightSide].perspective}
                playerName={columnHints[rightSide].playerName}
                htmlFor={`score-${index}-${rightSide}`}
              />
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2">
              <Input
                id={`score-${index}-${leftSide}`}
                type="number"
                inputMode="numeric"
                min={0}
                className="h-14 min-h-14 w-full min-w-0 touch-manipulation text-center text-2xl font-bold tabular-nums leading-none sm:h-12 sm:min-h-12 sm:text-2xl md:text-3xl"
                {...scoreSideNumericInputHandlers(set[leftSide], (n) =>
                  onSetValue(index, leftSide, String(n)),
                )}
              />
              <span
                className="flex h-14 items-center justify-center text-xl font-bold leading-none text-muted-foreground sm:h-12 sm:text-2xl"
                aria-hidden
              >
                -
              </span>
              <Input
                id={`score-${index}-${rightSide}`}
                type="number"
                inputMode="numeric"
                min={0}
                className="h-14 min-h-14 w-full min-w-0 touch-manipulation text-center text-2xl font-bold tabular-nums leading-none sm:h-12 sm:min-h-12 sm:text-2xl md:text-3xl"
                {...scoreSideNumericInputHandlers(set[rightSide], (n) =>
                  onSetValue(index, rightSide, String(n)),
                )}
              />
            </div>
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
  const [specialMode, setSpecialMode] = useState<SpecialResultMode>('normal')
  const [retirementActor, setRetirementActor] = useState<RetirementActor>(null)
  const [walkoverWinner, setWalkoverWinner] = useState<ScoreWinnerSide | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [capturePerspective, setCapturePerspective] = useState<CapturePerspective>('viewer')

  useEffect(() => {
    if (!open || !match) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincronizar estado local del diálogo con `match` al abrir */
    const nextType = match.game_type ?? 'best_of_3'
    setSubmitAttempted(false)
    setCapturePerspective('viewer')
    setGameType(nextType)
    setSpecialMode(
      match.result_type === 'retired' || match.result_type === 'retired_draw'
        ? 'retired'
        : match.result_type === 'wo'
          ? 'wo'
          : 'normal',
    )
    setRetirementActor(match.result_type === 'retired_draw' ? 'both' : null)
    setWalkoverWinner(match.result_type === 'wo' && match.winner_id === match.player_b_id ? 'b' : match.result_type === 'wo' && match.winner_id === match.player_a_id ? 'a' : null)
    if (nextType === 'sudden_death') {
      const raw = match.score_raw
      const decisive =
        raw?.length === 3
          ? normalizeSet(raw[2])
          : raw?.length === 1
            ? normalizeSet(raw[0])
            : { a: 0, b: 0 }
      setSets([decisive])
    } else {
      setSets(match.score_raw?.length ? match.score_raw.map(normalizeSet) : [{ a: 0, b: 0 }, { a: 0, b: 0 }])
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [match, open])

  const names = useMemo(() => (match ? namesForMatch(match, players) : { a: 'Jugador A', b: 'Jugador B' }), [match, players])

  const isYouA = match != null && match.player_a_id === viewerGroupPlayerId
  const viewerCanonicalSide = isYouA ? ('a' as const) : ('b' as const)
  const rivalCanonicalSide: 'a' | 'b' = viewerCanonicalSide === 'a' ? 'b' : 'a'
  const capturePrimarySide = capturePerspective === 'viewer' ? viewerCanonicalSide : rivalCanonicalSide
  const captureSecondarySide: 'a' | 'b' = capturePrimarySide === 'a' ? 'b' : 'a'
  const columnHints = {
    a: { perspective: isYouA ? 'Tú' : 'Rival', playerName: names.a },
    b: { perspective: isYouA ? 'Rival' : 'Tú', playerName: names.b },
  } as const

  const normalizedSets = sets.map(normalizeSet)
  const bestOf3Sets = shouldShowThirdSet(normalizedSets.slice(0, 2))
    ? normalizedSets.slice(0, 3)
    : normalizedSets.slice(0, 2)
  const retirementScoreSets = normalizedSets
    .slice(0, 3)
    .filter((set) => set.a > 0 || set.b > 0)
  const retirementWinner: ScoreWinnerSide | null =
    retirementActor === 'a' ? 'b' : retirementActor === 'b' ? 'a' : null
  const isRetirementMode =
    (gameType === 'best_of_3' || gameType === 'sudden_death') && specialMode === 'retired'
  const isWalkoverMode = specialMode === 'wo'
  const incompleteValidation = validateIncompleteBestOf3Score(retirementScoreSets)
  const suddenDecisiveSet = gameType === 'sudden_death' ? normalizedSets[0] : null
  const validation = (() => {
    if (isWalkoverMode) {
      return {
        ok: walkoverWinner != null,
        errors: walkoverWinner ? [] : ['Indica quien gana por W.O.'],
        winner: walkoverWinner,
      }
    }
    if (isRetirementMode) {
      const errors = [...incompleteValidation.errors]
      if (gameType === 'sudden_death') errors.length = 0
      if (!retirementActor) errors.push('Indica quien se retira o si se retiran ambos.')
      return {
        ok: errors.length === 0,
        errors,
        winner: retirementWinner,
      }
    }
    if (gameType === 'best_of_3')
      return validateBestOf3Score(bestOf3Sets, {
        allowShortDecisiveSet: true,
        gamesPerSet: rules?.games_per_set ?? rules?.set_points ?? 6,
      })
    if (gameType === 'long_set') return validateLongSetScore(normalizedSets[0])
    if (gameType === 'sudden_death') {
      if (!suddenDecisiveSet) {
        return { ok: false, errors: ['Captura el resultado del set decisivo.'], winner: null as ScoreWinnerSide | null }
      }
      const thirdErr = validateSuddenDeathThirdSet(suddenDecisiveSet)
      const sdWinner = thirdErr ? null : getSetWinner(suddenDecisiveSet)
      return {
        ok: !thirdErr && sdWinner != null,
        errors: thirdErr ? [thirdErr] : sdWinner ? [] : ['Captura el resultado del set decisivo.'],
        winner: sdWinner,
      }
    }
    return { ok: false, errors: ['Sin reglas del torneo.'], winner: null as ScoreWinnerSide | null }
  })()
  const winner = validation.winner
  const scoreForPayload =
    gameType === 'best_of_3'
      ? isRetirementMode
        ? retirementScoreSets
        : bestOf3Sets
      : gameType === 'sudden_death'
        ? suddenDecisiveSet
          ? [suddenDecisiveSet]
          : []
        : [normalizedSets[0]]
  const scoreLabel =
    gameType === 'sudden_death'
      ? suddenDecisiveSet && validation.winner
        ? formatScoreCompact([suddenDecisiveSet])
        : 'muerte súbita'
      : formatScoreCompact(scoreForPayload)
  const decidedInTwo = gameType === 'best_of_3' && bestOf3Sets.length === 2 && validation.ok

  const youWon =
    winner != null && ((winner === 'a' && isYouA) || (winner === 'b' && !isYouA))

  const yourName = isYouA ? names.a : names.b
  const rivalName = isYouA ? names.b : names.a

  /** Sets en orden «tú primero» para el resumen legible. */
  const viewerSetsForSummary =
    gameType === 'sudden_death'
      ? suddenDecisiveSet && validation.winner
        ? isYouA
          ? [suddenDecisiveSet]
          : invertScoreSets([suddenDecisiveSet])
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
    setSubmitAttempted(false)
    const next = [...sets]
    const num = Math.max(0, Number(value) || 0)
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
    setSpecialMode('normal')
    setRetirementActor(null)
    setWalkoverWinner(null)
    setSubmitAttempted(false)
    setCapturePerspective('viewer')
    setSets(
      nextType === 'long_set'
        ? [{ a: 0, b: 0 }]
        : nextType === 'sudden_death'
          ? [{ a: 0, b: 0 }]
          : [{ a: 0, b: 0 }, { a: 0, b: 0 }],
    )
  }

  const handleSubmit = async () => {
    setSubmitAttempted(true)
    if (isRetirementMode) {
      if (!validation.ok) {
        toast.error(validation.errors[0] ?? 'Resultado incompleto invalido')
        return
      }
      const payload: ScorePayload =
        winner == null
          ? {
              game_type: gameType === 'sudden_death' ? 'sudden_death' : 'best_of_3',
              score_json: scoreForPayload,
              winner: null,
              result_type: 'retired_draw',
            }
          : {
              game_type: gameType === 'sudden_death' ? 'sudden_death' : 'best_of_3',
              score_json: scoreForPayload,
              winner,
              result_type: 'retired',
            }
      await onSubmit(payload)
      return
    }
    if (isWalkoverMode) {
      if (!validation.ok || !winner) {
        toast.error(validation.errors[0] ?? 'Indica quien gana por W.O.')
        return
      }
      const payload: ScorePayload = {
        game_type: gameType === 'sudden_death' ? 'sudden_death' : 'best_of_3',
        score_json: null,
        winner,
        result_type: 'wo',
      }
      await onSubmit(payload)
      return
    }
    if (!validation.ok || !winner) {
      toast.error(validation.errors[0] ?? 'Marcador inválido')
      return
    }
    const payload: ScorePayload =
      gameType === 'sudden_death'
        ? {
            game_type: 'sudden_death',
            score_json: scoreForPayload,
            winner,
          }
        : gameType === 'long_set'
          ? { game_type: 'long_set', score_json: [scoreForPayload[0] ?? { a: 0, b: 0 }], winner }
          : { game_type: 'best_of_3', score_json: scoreForPayload, winner }
    await onSubmit(payload)
  }

  const calculatedWinnerName = winner != null ? (winner === 'a' ? names.a : names.b) : null
  const incompleteSummary =
    specialMode === 'retired' && retirementActor === 'both'
      ? 'Retiro de ambos: ambos jugadores reciben 1 punto.'
      : specialMode === 'retired' && calculatedWinnerName
        ? `Retiro: gana ${calculatedWinnerName}.`
        : specialMode === 'wo' && calculatedWinnerName
          ? `W.O.: gana ${calculatedWinnerName}.`
          : null

  if (!match || !rules) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(100svh,46rem)] w-[calc(100vw-1rem)] max-w-[min(100vw-1rem,42rem)] flex-col overflow-hidden rounded-2xl p-0 sm:max-h-[min(90dvh,46rem)] sm:w-full sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-2 border-b border-border/70 px-3 pb-3 pt-4 pr-11 sm:px-5 sm:pb-3.5 sm:pt-5 sm:pr-14">
          <DialogTitle className="text-base leading-tight sm:text-lg">Registrar marcador</DialogTitle>
          <DialogDescription className="text-pretty text-[11px] leading-relaxed text-muted-foreground sm:text-sm">
            Los números se guardan en orden del torneo (jugadores A y B del cruce). En pantalla,{' '}
            <span className="font-medium text-foreground">Tú</span> va siempre a la{' '}
            <span className="font-medium text-foreground">izquierda</span> y el rival a la derecha para revisar antes
            de enviar.
          </DialogDescription>
          <p className="flex flex-wrap gap-x-2 gap-y-1 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[10px] font-medium leading-snug text-muted-foreground ring-1 ring-border/40 sm:text-xs">
            <span>
              <span className="text-foreground">1.</span> Tipo de partido
            </span>
            <span className="text-muted-foreground/35" aria-hidden>
              ·
            </span>
            <span>
              <span className="text-foreground">2.</span> Quién eres
            </span>
            <span className="text-muted-foreground/35" aria-hidden>
              ·
            </span>
            <span>
              <span className="text-foreground">3.</span> Games por set
            </span>
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] [-webkit-overflow-scrolling:touch] sm:space-y-6 sm:px-5 sm:py-4 sm:pb-4">
          <GameTypeSelector value={gameType} onChange={changeGameType} />
          <PlayersPerspectiveHeader
            leftHead={columnHints[capturePrimarySide]}
            rightHead={columnHints[captureSecondarySide]}
          />
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Marcador</p>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
                {[
                  { value: 'viewer' as const, label: 'Tu primero', side: viewerCanonicalSide },
                  { value: 'rival' as const, label: 'Rival primero', side: rivalCanonicalSide },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'min-h-9 rounded-lg px-2.5 text-xs font-semibold transition-colors',
                      capturePerspective === option.value
                        ? 'bg-white text-[#12372F] shadow-sm ring-1 ring-border/60'
                        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                    )}
                    aria-pressed={capturePerspective === option.value}
                    onClick={() => {
                      setSubmitAttempted(false)
                      setCapturePerspective(option.value)
                    }}
                  >
                    {option.label}
                    <span className="block truncate text-[10px] font-medium text-muted-foreground">
                      {columnHints[option.side].playerName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <p className="rounded-xl border border-border/60 bg-muted/25 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              El primer numero de cada set pertenece a la columna izquierda. Cambia a Rival primero si vas a capturar el marcador desde la vista del rival o ganador.
            </p>
            <ScoreInputs
            gameType={gameType}
            sets={
              gameType === 'sudden_death'
                ? sets.slice(0, 1)
                : gameType === 'best_of_3' && shouldShowThirdSet(normalizedSets.slice(0, 2)) && sets.length < 3
                  ? [...sets, { a: 0, b: 0 }]
                  : sets
            }
            columnHints={columnHints}
            primaryCanonicalSide={capturePrimarySide}
            onSetValue={setValue}
          />
          </div>

          {(gameType === 'best_of_3' || gameType === 'sudden_death') ? (
            <section className="space-y-3 rounded-xl border border-border/70 bg-background/80 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Resultado especial
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Usa retiro si el partido inicio y no pudo terminar; usa W.O. si no se jugo.
                  </p>
                </div>
                {specialMode === 'retired' && gameType === 'best_of_3' ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                    Games {incompleteValidation.games.a}-{incompleteValidation.games.b}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={cn(
                    'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                    specialMode === 'retired'
                      ? 'border-[#1F5A4C] bg-emerald-50 text-[#12372F] shadow-sm'
                      : 'border-border/70 bg-muted/20 text-foreground hover:bg-muted/50',
                  )}
                  aria-pressed={specialMode === 'retired'}
                  onClick={() => {
                    setSubmitAttempted(false)
                    setWalkoverWinner(null)
                    setSpecialMode((mode) => (mode === 'retired' ? 'normal' : 'retired'))
                  }}
                >
                  <UserX className="size-4" aria-hidden />
                  {specialMode === 'retired' ? 'Retiro marcado' : 'Marcar como retiro'}
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                    specialMode === 'wo'
                      ? 'border-[#1F5A4C] bg-emerald-50 text-[#12372F] shadow-sm'
                      : 'border-border/70 bg-muted/20 text-foreground hover:bg-muted/50',
                  )}
                  aria-pressed={specialMode === 'wo'}
                  onClick={() => {
                    setSubmitAttempted(false)
                    setRetirementActor(null)
                    setSpecialMode((mode) => (mode === 'wo' ? 'normal' : 'wo'))
                  }}
                >
                  <Trophy className="size-4" aria-hidden />
                  {specialMode === 'wo' ? 'W.O. marcado' : 'Victoria por W.O.'}
                </button>
              </div>

              {specialMode === 'retired' ? (
                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-2.5">
                  <p className="text-xs font-semibold text-foreground">Quien se retira</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      { value: 'a' as const, label: names.a },
                      { value: 'b' as const, label: names.b },
                      { value: 'both' as const, label: 'Ambos' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          'min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
                          retirementActor === option.value
                            ? 'border-[#1F5A4C] bg-white text-[#12372F] shadow-sm'
                            : 'border-border/70 bg-white/70 text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() => {
                          setSubmitAttempted(false)
                          setRetirementActor(option.value)
                        }}
                      >
                        {option.value === 'both' ? option.label : `${option.label} se retira`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {specialMode === 'wo' ? (
                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-2.5">
                  <p className="text-xs font-semibold text-foreground">Ganador por W.O.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { value: 'a' as const, label: names.a },
                      { value: 'b' as const, label: names.b },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          'min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
                          walkoverWinner === option.value
                            ? 'border-[#1F5A4C] bg-white text-[#12372F] shadow-sm'
                            : 'border-border/70 bg-white/70 text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() => {
                          setSubmitAttempted(false)
                          setWalkoverWinner(option.value)
                        }}
                      >
                        Gana {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

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

            {(isRetirementMode || isWalkoverMode) && incompleteSummary ? (
              <div className="mt-3 rounded-lg border border-emerald-600/15 bg-emerald-50/80 px-3 py-3">
                <p className="text-sm font-semibold leading-snug text-emerald-950">{incompleteSummary}</p>
                {isRetirementMode && gameType === 'best_of_3' ? (
                  <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                    Marcador registrado: {scoreLabel}
                  </p>
                ) : null}
              </div>
            ) : winner == null ? (
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
                      ? `Resultado: ${scoreLabel}.`
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

          {submitAttempted && !validation.ok ? (
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
          ) : validation.ok ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="size-4" />
                Marcador listo para enviar
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 rounded-b-2xl border-t border-border/70 bg-background/95 px-3 pt-3 backdrop-blur-sm supports-[backdrop-filter]:bg-background/85 sm:flex-row sm:justify-end sm:gap-3 sm:px-5 sm:pt-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <Button
            type="button"
            variant="outline"
            className="w-full min-h-12 touch-manipulation sm:min-h-10 sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={submitting}
            className="w-full min-h-12 touch-manipulation sm:min-h-10 sm:w-auto"
            onClick={handleSubmit}
          >
            {submitting ? 'Enviando…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

