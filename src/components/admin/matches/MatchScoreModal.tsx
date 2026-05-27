import type { ComponentProps } from 'react'

import { AdminScoreCorrectionModal } from '@/components/admin/results/AdminScoreCorrectionModal'

export type MatchScoreModalProps = ComponentProps<typeof AdminScoreCorrectionModal>

function deriveTitle(match: NonNullable<MatchScoreModalProps['match']>): string {
  if (match.status === 'pending_score') return 'Registrar marcador'
  if (match.status === 'score_disputed') return 'Corregir marcador'
  return 'Corregir marcador'
}

/** Modal único de marcador admin: registrar, corregir o resolver disputa. */
export function MatchScoreModal({ title, match, ...rest }: MatchScoreModalProps) {
  return (
    <AdminScoreCorrectionModal
      {...rest}
      match={match}
      title={title ?? (match ? deriveTitle(match) : undefined)}
    />
  )
}
