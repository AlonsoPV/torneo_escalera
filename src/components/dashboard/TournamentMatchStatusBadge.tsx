import type { MatchRow } from '@/types/database'

import { matchStatusLabels, matchStatusToneClasses } from '@/lib/matchStatus'
import { cn } from '@/lib/utils'

export function TournamentMatchStatusBadge({
  status,
  className,
}: {
  status: MatchRow['status']
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold tracking-tight',
        matchStatusToneClasses[status],
        className,
      )}
    >
      {matchStatusLabels[status] ?? status}
    </span>
  )
}
