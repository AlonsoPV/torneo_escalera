import {
  MatchFeedActionBar,
  MatchFeedCard,
  MatchFeedCompactHeader,
  MatchFeedEditButton,
  MatchFeedLogButton,
  MatchFeedLogDialog,
  MatchFeedStatusBanner,
  MatchFeedValidateButton,
  MatchFeedWaitingLabel,
  MatchFeedWorkflowTimeline,
  formatCompactMatchScoreFromWinnerPerspective,
  resolveFeedWinnerName,
  resolveMatchFeedVisualState,
  shortFeedDate,
  useMatchFeedLogDialog,
  type MatchFeedTimelineStep,
  type MatchFeedLogEntry,
} from '@/components/shared/MatchSportsFeed'
import { adminNotesLogEntry } from '@/lib/playerMatchFeed'
import type { AdminMatchRecord } from '@/services/admin'

function buildWorkflowSteps(match: AdminMatchRecord, isDisputed: boolean, isRefutedPending: boolean): MatchFeedTimelineStep[] {
  const steps: MatchFeedTimelineStep[] = []

  if (match.scoreSubmittedByLabel) {
    steps.push({
      kind: 'success',
      text: `Marcador enviado por ${match.scoreSubmittedByLabel}`,
    })
  }

  const disputer = match.disputedByLabel
  if (disputer && (isDisputed || isRefutedPending || match.dispute_reason)) {
    steps.push({
      kind: 'warning',
      text: `${disputer} refutó el resultado`,
    })
  }

  if (isDisputed) {
    steps.push({ kind: 'pending', text: 'Esperando validación administrativa' })
  } else if (isRefutedPending) {
    steps.push({ kind: 'pending', text: 'Volvió a pendiente tras refutación' })
  } else if (match.status === 'score_submitted') {
    steps.push({ kind: 'pending', text: 'Esperando confirmación del rival' })
  } else if (match.status === 'validated') {
    steps.push({ kind: 'success', text: 'Validado por administración' })
  } else if (match.status === 'closed') {
    steps.push({ kind: 'success', text: 'Resultado oficial entre jugadores' })
  }

  return steps
}

function buildLogEntries(match: AdminMatchRecord, isRefutedPending: boolean): MatchFeedLogEntry[] {
  return [
    { label: 'Registró', value: match.scoreSubmittedByLabel ?? '—' },
    { label: 'Refutó', value: match.disputedByLabel ?? '—' },
    {
      label: 'Motivo refutación',
      value: match.dispute_reason?.trim() || '—',
      multiline: Boolean(match.dispute_reason?.trim()),
    },
    adminNotesLogEntry(match.admin_notes),
    {
      label: 'Estado',
      value: isRefutedPending ? 'Refutado · pendiente de marcador' : match.status,
    },
    { label: 'Enviado', value: shortFeedDate(match.score_submitted_at) ?? '—' },
    { label: 'Refutado', value: shortFeedDate(match.disputed_at) ?? '—' },
    { label: 'ID partido', value: match.id },
  ]
}

export function AdminResultReviewRow({
  match,
  quickReview,
  onConfirm,
  onCorrect,
  onValidateAsIs,
  validatePending = false,
}: {
  match: AdminMatchRecord
  quickReview: boolean
  onConfirm: (match: AdminMatchRecord) => void
  onCorrect: (match: AdminMatchRecord) => void
  onValidateAsIs?: (match: AdminMatchRecord) => void
  validatePending?: boolean
}) {
  const { logOpen, setLogOpen } = useMatchFeedLogDialog()
  const isRefutedPending = match.status === 'pending_score' && Boolean(match.disputed_by)
  const isDisputed = match.status === 'score_disputed'
  const isPendingRival = match.status === 'score_submitted'
  const canValidateLegacy = match.status === 'player_confirmed' || match.status === 'score_submitted'
  const showDisputeActions = isDisputed && !quickReview
  const showLegacyActions = canValidateLegacy && !quickReview && !isDisputed
  const visualState = resolveMatchFeedVisualState(match.status, isRefutedPending)
  const rowId = `admin-notifications-dispute-${match.id}`
  const workflowSteps = buildWorkflowSteps(match, isDisputed, isRefutedPending)
  const dateLabel = shortFeedDate(match.disputed_at ?? match.score_submitted_at ?? match.updated_at)
  const scoreLabel = formatCompactMatchScoreFromWinnerPerspective(
    match.score_raw,
    match.winner_id,
    match.player_a_id,
    match.player_b_id,
  )
  const winnerName = resolveFeedWinnerName(
    match.winner_id,
    match.player_a_id,
    match.player_b_id,
    match.playerAName,
    match.playerBName,
  )

  return (
    <>
      <MatchFeedCard id={rowId} dataName="notifications-dispute-row" visualState={visualState}>
        <MatchFeedStatusBanner visualState={visualState} />

        <MatchFeedCompactHeader
          groupName={match.groupName}
          tournamentName={match.tournamentName}
          playerAName={match.playerAName}
          playerBName={match.playerBName}
          dateLabel={dateLabel}
          scoreLabel={scoreLabel}
          winnerName={winnerName}
        />

        <MatchFeedWorkflowTimeline steps={workflowSteps} defaultCollapsed />

        {!quickReview ? (
          <MatchFeedActionBar>
            <MatchFeedLogButton onClick={() => setLogOpen(true)} />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {showDisputeActions ? (
                <>
                  <MatchFeedValidateButton
                    id={`${rowId}-btn-validate`}
                    name={`validate-dispute-${match.id}`}
                    pending={validatePending}
                    disabled={!onValidateAsIs}
                    onClick={() => onValidateAsIs?.(match)}
                  />
                  <MatchFeedEditButton
                    id={`${rowId}-btn-correct`}
                    name={`correct-dispute-${match.id}`}
                    disabled={validatePending}
                    onClick={() => onCorrect(match)}
                  />
                </>
              ) : null}

              {showLegacyActions ? (
                <>
                  <MatchFeedValidateButton
                    id={`${rowId}-btn-validate-legacy`}
                    pending={validatePending}
                    disabled={!canValidateLegacy}
                    onClick={() => onConfirm(match)}
                  />
                  <MatchFeedEditButton
                    id={`${rowId}-btn-correct-legacy`}
                    onClick={() => onCorrect(match)}
                  />
                </>
              ) : null}

              {isPendingRival && !isDisputed ? (
                <MatchFeedWaitingLabel>Esperando rival</MatchFeedWaitingLabel>
              ) : null}
            </div>
          </MatchFeedActionBar>
        ) : null}
      </MatchFeedCard>

      <MatchFeedLogDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        entries={buildLogEntries(match, isRefutedPending)}
      />
    </>
  )
}
