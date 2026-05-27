/* eslint-disable react-refresh/only-export-components */
import { Inbox, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { AdminMatchRecord } from '@/services/admin'
import type { MatchStatus } from '@/types/database'

export type ReviewTabId = 'pendientes' | 'disputed' | 'waiting' | 'official' | 'all'

export const REVIEW_TABS: { id: ReviewTabId; label: string }[] = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'disputed', label: 'Disputas · revisión' },
  { id: 'waiting', label: 'Confirmado · puede refutarse' },
  { id: 'official', label: 'Oficiales / validados' },
  { id: 'all', label: 'Todos' },
]

export const STATUS_FILTER_ITEMS: { value: MatchStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending_score', label: 'Sin marcador' },
  { value: 'score_submitted', label: 'Confirmado · puede refutarse' },
  { value: 'score_disputed', label: 'Disputa · revisión admin' },
  { value: 'closed', label: 'Oficial (jugador)' },
  { value: 'validated', label: 'Validado (admin)' },
  { value: 'cancelled', label: 'Cancelado' },
]

export function CompactEmpty({
  title,
  id,
  dataName,
}: {
  title: string
  id?: string
  dataName?: string
}) {
  return (
    <div
      id={id}
      data-name={dataName}
      className="flex max-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200/90 bg-white/90 px-4 py-5 text-center shadow-sm"
    >
      <Inbox className="size-7 text-slate-300" aria-hidden />
      <p className="text-sm font-medium text-slate-700">{title}</p>
    </div>
  )
}

export function MetricMini({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon
  label: string
  value: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative flex max-h-[90px] min-h-[76px] flex-col justify-between rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      <Icon className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-slate-950/25" aria-hidden />
      <span className="max-w-[85%] text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</span>
      <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-950">{value}</span>
    </div>
  )
}

export function tabFilterRows(rows: AdminMatchRecord[], tab: ReviewTabId): AdminMatchRecord[] {
  switch (tab) {
    case 'pendientes':
      return rows.filter((m) => m.status === 'player_confirmed')
    case 'disputed':
      return rows.filter((m) => m.status === 'score_disputed' || (m.status === 'pending_score' && Boolean(m.disputed_by)))
    case 'waiting':
      return rows.filter((m) => m.status === 'score_submitted')
    case 'official':
      return rows.filter((m) => m.status === 'closed' || m.status === 'validated')
    default:
      return rows
  }
}

export function sortRowsForTab(rows: AdminMatchRecord[], tab: ReviewTabId): AdminMatchRecord[] {
  const arr = [...rows]
  const t = (iso: string | null | undefined) => {
    if (!iso) return 0
    const n = new Date(iso).getTime()
    return Number.isNaN(n) ? 0 : n
  }
  switch (tab) {
    case 'pendientes':
      return arr.sort((a, b) => t(a.opponent_confirmed_at) - t(b.opponent_confirmed_at))
    case 'disputed':
      return arr.sort((a, b) => t(b.updated_at) - t(a.updated_at))
    case 'waiting':
      return arr.sort((a, b) => t(a.score_submitted_at) - t(b.score_submitted_at))
    case 'official':
      return arr.sort((a, b) => t(b.admin_validated_at ?? b.closed_at) - t(a.admin_validated_at ?? a.closed_at))
    default:
      return arr.sort((a, b) => t(b.updated_at) - t(a.updated_at))
  }
}
