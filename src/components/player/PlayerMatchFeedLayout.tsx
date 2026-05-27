import type { ReactNode } from 'react'

import { MatchScoreTimeline } from '@/components/player/MatchScoreTimeline'
import {
  MatchFeedActionBar,
  MatchFeedCard,
  MatchFeedCompactHeader,
  MatchFeedLogButton,
  MatchFeedLogDialog,
  MatchFeedStatusBanner,
  MatchFeedWorkflowTimeline,
  formatCompactMatchScore,
  resolveFeedWinnerName,
  resolveMatchFeedVisualState,
  shortFeedDate,
  useMatchFeedLogDialog,
  type MatchFeedTimelineStep,
  type MatchFeedLogEntry,
} from '@/components/shared/MatchSportsFeed'
import { buildPlayerLogEntries, buildPlayerWorkflowSteps, resolveMatchPlayerNames } from '@/lib/playerMatchFeed'
import { cn } from '@/lib/utils'
import type { GroupPlayer, MatchRow } from '@/types/database'

export function PlayerMatchFeedLayout({
  match,
  players,
  userId,
  groupName,
  metaLabel,
  footer,
  workflowSteps: workflowStepsProp,
  logEntries: logEntriesProp,
  showLog = true,
  showScoreTimelineInLog = true,
  iSubmittedPending,
  className,
  id,
}: {
  match: MatchRow
  players: GroupPlayer[]
  userId: string
  groupName: string
  metaLabel: string
  footer?: ReactNode
  workflowSteps?: MatchFeedTimelineStep[]
  logEntries?: MatchFeedLogEntry[]
  showLog?: boolean
  showScoreTimelineInLog?: boolean
  iSubmittedPending?: boolean
  className?: string
  id?: string
}) {
  const { logOpen, setLogOpen } = useMatchFeedLogDialog()
  const isRefutedPending = match.status === 'pending_score' && Boolean(match.disputed_by)
  const visualState = resolveMatchFeedVisualState(match.status, isRefutedPending)
  const { playerAName, playerBName } = resolveMatchPlayerNames(match, players)
  const scoreLabel = formatCompactMatchScore(match.score_raw)
  const winnerName = resolveFeedWinnerName(
    match.winner_id,
    match.player_a_id,
    match.player_b_id,
    playerAName,
    playerBName,
  )
  const dateLabel = shortFeedDate(match.disputed_at ?? match.score_submitted_at ?? match.updated_at)
  const workflowSteps =
    workflowStepsProp ?? buildPlayerWorkflowSteps(match, players, userId, { iSubmittedPending })
  const logEntries = logEntriesProp ?? buildPlayerLogEntries(match, players, userId)

  return (
    <>
      <MatchFeedCard id={id} visualState={visualState} className={cn(className)}>
        <MatchFeedStatusBanner visualState={visualState} />

        <MatchFeedCompactHeader
          groupName={groupName}
          tournamentName={metaLabel}
          playerAName={playerAName}
          playerBName={playerBName}
          dateLabel={dateLabel}
          scoreLabel={scoreLabel}
          winnerName={winnerName}
        />

        {workflowSteps.length > 0 ? (
          <MatchFeedWorkflowTimeline steps={workflowSteps} defaultCollapsed />
        ) : null}

        {footer || showLog ? (
          <MatchFeedActionBar>
            {showLog ? <MatchFeedLogButton onClick={() => setLogOpen(true)} /> : <span />}
            {footer ? <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
          </MatchFeedActionBar>
        ) : null}
      </MatchFeedCard>

      {showLog ? (
        <MatchFeedLogDialog open={logOpen} onOpenChange={setLogOpen} entries={logEntries}>
          {showScoreTimelineInLog ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Historial de cambios
              </p>
              <MatchScoreTimeline matchId={match.id} />
            </div>
          ) : null}
        </MatchFeedLogDialog>
      ) : null}
    </>
  )
}
