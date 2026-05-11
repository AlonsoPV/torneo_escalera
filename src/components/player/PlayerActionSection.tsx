import { CheckCircle2, ClipboardList } from 'lucide-react'

import { PlayerMatchActionCard } from '@/components/player/PlayerMatchActionCard'
import { canAcceptScore, canSubmitScore } from '@/lib/matchStatus'
import { cn } from '@/lib/utils'
import type { GroupPlayer, MatchRow, TournamentRules } from '@/types/database'

function actionHeadline(match: MatchRow | undefined, userId: string) {
  if (!match) {
    return {
      title: 'Todo al día',
      description: 'No tienes acciones pendientes por ahora.',
      tone: 'success' as const,
    }
  }

  if (canSubmitScore(match, userId)) {
    return {
      title: match.status === 'score_disputed'
        ? 'Tienes un marcador por corregir'
        : 'Tienes un marcador pendiente por registrar',
      description: 'Abre el partido, captura el resultado desde tu perspectiva y envíalo a tu rival.',
      tone: 'warning' as const,
    }
  }

  if (canAcceptScore(match, userId)) {
    return {
      title: 'Tienes un marcador pendiente por aceptar',
      description: 'Revisa el marcador espejo y acepta o rechaza si algo no coincide.',
      tone: 'warning' as const,
    }
  }

  return {
    title: 'Marcador en seguimiento',
    description: 'Hay partidos en proceso, pero no requieren una acción inmediata.',
    tone: 'neutral' as const,
  }
}

export function PlayerActionSection({
  matches,
  players,
  rules,
  myGroupPlayerId,
  userId,
  groupName,
  onAfterAction,
}: {
  matches: MatchRow[]
  players: GroupPlayer[]
  rules: TournamentRules
  myGroupPlayerId: string
  userId: string
  groupName: string
  onAfterAction: () => Promise<void>
}) {
  const headline = actionHeadline(matches[0], userId)
  const empty = matches.length === 0

  return (
    <section
      id="player-section-action-required"
      data-name="player-section-action-required"
      className="overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-sm"
    >
      <div className="border-b border-[#E2E8F0] bg-gradient-to-r from-white via-[#F6F3EE]/70 to-white px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl',
              headline.tone === 'success'
                ? 'bg-emerald-100 text-emerald-700'
                : headline.tone === 'warning'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600',
            )}
          >
            {empty ? <CheckCircle2 className="size-5" /> : <ClipboardList className="size-5" />}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#102A43]">{headline.title}</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-[#64748B]">{headline.description}</p>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        {empty ? (
          <p className="rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F6F3EE]/50 px-4 py-6 text-center text-sm text-[#64748B]">
            Todo al día. Cuando tengas un marcador por registrar o aceptar, aparecerá aquí.
          </p>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <PlayerMatchActionCard
                key={match.id}
                match={match}
                players={players}
                rules={rules}
                myGroupPlayerId={myGroupPlayerId}
                userId={userId}
                groupName={groupName}
                onAfterAction={onAfterAction}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
