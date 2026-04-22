import type { ReactNode } from 'react'

export function ClubChip({ children }: { children: ReactNode }) {
  return (
    <span className="club-chip">
      <span className="club-chip__dot" aria-hidden />
      <span>{children}</span>
    </span>
  )
}

export type ClubStatusVariant = 'active' | 'finished' | 'draft'

export function ClubStatusPill({ variant, children }: { variant: ClubStatusVariant; children: ReactNode }) {
  if (variant === 'active') {
    return (
      <span className="club-status club-status--active">
        <span className="club-status__pulse" aria-hidden />
        {children}
      </span>
    )
  }
  if (variant === 'finished') {
    return <span className="club-status club-status--finished">{children}</span>
  }
  return <span className="club-status club-status--draft">{children}</span>
}
