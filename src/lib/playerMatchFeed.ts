import type { MatchFeedLogEntry, MatchFeedTimelineStep } from '@/components/shared/MatchSportsFeed'
import { resolveDisputerLabel } from '@/lib/matchCardDisplay'
import { isPendingScoreStatus } from '@/lib/matchStatus'
import type { GroupPlayer, MatchGameType, MatchRow } from '@/types/database'

export function gameTypeLabel(gt: MatchGameType | null | undefined): string {
  if (gt === 'long_set') return 'Set largo'
  if (gt === 'sudden_death') return 'Muerte súbita'
  if (gt === 'best_of_3_short_tiebreak') return '2 de 3 (tie-break corto)'
  return 'Al mejor de 3'
}

export function resolveMatchPlayerNames(
  match: MatchRow,
  players: GroupPlayer[],
): { playerAName: string; playerBName: string } {
  const playerA = players.find((p) => p.id === match.player_a_id)
  const playerB = players.find((p) => p.id === match.player_b_id)
  return {
    playerAName: playerA?.display_name ?? 'Jugador',
    playerBName: playerB?.display_name ?? 'Jugador',
  }
}

export function resolveScoreSubmitterLabel(
  match: MatchRow,
  players: GroupPlayer[],
  viewerUserId: string,
): string | null {
  const hasScore = Boolean(match.score_raw?.length || match.game_type === 'sudden_death')
  if (!hasScore) return null

  if (match.score_submitted_by === viewerUserId) return 'Tú'
  const submitter = players.find((p) => p.user_id === match.score_submitted_by)
  if (submitter) return submitter.display_name

  if (match.score_submitted_by == null) {
    const playerA = players.find((p) => p.id === match.player_a_id)
    return playerA?.display_name ?? null
  }

  return 'Rival'
}

export function buildPlayerWorkflowSteps(
  match: MatchRow,
  players: GroupPlayer[],
  viewerUserId: string,
  opts?: { iSubmittedPending?: boolean },
): MatchFeedTimelineStep[] {
  const steps: MatchFeedTimelineStep[] = []
  const isRefutedPending = match.status === 'pending_score' && Boolean(match.disputed_by)

  const submitter = resolveScoreSubmitterLabel(match, players, viewerUserId)
  if (submitter) {
    steps.push({ kind: 'success', text: `Marcador enviado por ${submitter}` })
  }

  const disputer = resolveDisputerLabel(match, players, viewerUserId)
  if (disputer && (match.status === 'score_disputed' || isRefutedPending || match.disputed_by)) {
    steps.push({ kind: 'warning', text: `${disputer} refutó el resultado` })
  }

  if (match.status === 'score_disputed') {
    steps.push({ kind: 'pending', text: 'Esperando validación administrativa' })
  } else if (isRefutedPending) {
    steps.push({ kind: 'pending', text: 'Pendiente de nuevo marcador' })
  } else if (match.status === 'score_submitted') {
    steps.push({
      kind: 'pending',
      text: opts?.iSubmittedPending
        ? 'Esperando confirmación del rival'
        : 'Puedes refutar si no coincide con lo jugado',
    })
  } else if (match.status === 'validated') {
    steps.push({ kind: 'success', text: 'Validado por organización' })
  } else if (match.status === 'closed') {
    steps.push({ kind: 'success', text: 'Resultado oficial' })
  } else if (match.status === 'cancelled') {
    steps.push({ kind: 'error', text: 'Partido cancelado' })
  } else if (isPendingScoreStatus(match.status)) {
    steps.push({ kind: 'pending', text: 'Pendiente de marcador' })
  } else if (match.status === 'player_confirmed') {
    steps.push({ kind: 'pending', text: 'Pendiente de cierre por organización' })
  }

  return steps
}

export function adminNotesLogEntry(adminNotes: string | null | undefined): MatchFeedLogEntry {
  const text = adminNotes?.trim()
  return {
    label: 'Notas de admin',
    value: text || '—',
    multiline: Boolean(text),
  }
}

export function buildPlayerLogEntries(
  match: MatchRow,
  players: GroupPlayer[],
  viewerUserId: string,
  extras?: { outcome?: string | null; impact?: string | null },
): MatchFeedLogEntry[] {
  const submitter = resolveScoreSubmitterLabel(match, players, viewerUserId)
  const disputer = resolveDisputerLabel(match, players, viewerUserId)
  return [
    { label: 'Registró', value: submitter ?? '—' },
    { label: 'Refutó', value: disputer ?? '—' },
    { label: 'Motivo refutación', value: match.dispute_reason?.trim() || '—', multiline: Boolean(match.dispute_reason?.trim()) },
    adminNotesLogEntry(match.admin_notes),
    { label: 'Estado', value: match.status },
    ...(extras?.outcome ? [{ label: 'Resultado', value: extras.outcome }] : []),
    ...(extras?.impact ? [{ label: 'Impacto', value: extras.impact }] : []),
    { label: 'ID partido', value: match.id },
  ]
}
