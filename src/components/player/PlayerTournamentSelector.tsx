import { useMemo } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PlayerDashboardContextSummary } from '@/services/dashboardPlayer'
import { tournamentStatusLabel } from '@/services/playerViewModel'
import { cn } from '@/lib/utils'

type Props = {
  contexts: PlayerDashboardContextSummary[]
  value: string
  onChange: (groupId: string) => void
  className?: string
}

function contextMenuLabel(c: PlayerDashboardContextSummary): string {
  return c.group.name && c.group.name !== c.tournament.name
    ? `${c.tournament.name} · ${c.group.name}`
    : c.tournament.name
}

export function PlayerTournamentSelector({ contexts, value, onChange, className }: Props) {
  const triggerLabel = useMemo(() => {
    const c = contexts.find((x) => x.group.id === value)
    return c ? contextMenuLabel(c) : undefined
  }, [contexts, value])

  if (contexts.length <= 1) return null

  return (
    <div className={cn('flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3', className)}>
      <span className="text-xs font-semibold tracking-wide text-[#64748B] uppercase">Torneo</span>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v != null) onChange(v)
        }}
      >
        <SelectTrigger
          size="sm"
          className="h-10 min-w-[200px] max-w-[280px] w-auto border-[#E2E8F0] bg-white text-[#102A43]"
        >
          <SelectValue placeholder="Selecciona torneo">{triggerLabel ?? undefined}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {contexts.map((c) => {
            const status = tournamentStatusLabel(c.tournament.status)
            const label = contextMenuLabel(c)
            return (
              <SelectItem key={c.group.id} value={c.group.id} label={label}>
                <span className="flex flex-col gap-0.5 text-left">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground text-xs font-normal">{status}</span>
                </span>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
