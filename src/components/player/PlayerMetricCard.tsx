import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type Tone = 'gold' | 'primary' | 'blue' | 'green' | 'red' | 'amber'

const toneClasses: Record<Tone, { card: string; icon: string; value: string }> = {
  gold: {
    card: 'border-[#C8A96B]/35 bg-[#FFF9EA]',
    icon: 'bg-[#C8A96B]/20 text-[#7A5A16]',
    value: 'text-[#7A5A16]',
  },
  primary: {
    card: 'border-[#1F5A4C]/20 bg-[#F0F7F4]',
    icon: 'bg-[#1F5A4C]/12 text-[#1F5A4C]',
    value: 'text-[#1F5A4C]',
  },
  blue: {
    card: 'border-blue-200 bg-blue-50',
    icon: 'bg-blue-100 text-blue-700',
    value: 'text-blue-800',
  },
  green: {
    card: 'border-emerald-200 bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-700',
    value: 'text-emerald-700',
  },
  red: {
    card: 'border-red-200 bg-red-50',
    icon: 'bg-red-100 text-red-700',
    value: 'text-red-700',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50',
    icon: 'bg-amber-100 text-amber-700',
    value: 'text-amber-700',
  },
}

export function PlayerMetricCard({
  label,
  labelShort,
  value,
  icon: Icon,
  tone,
  compact = false,
  className,
}: {
  label: string
  /** Etiqueta más corta en pantallas estrechas (compact). */
  labelShort?: string
  value: string
  icon: LucideIcon
  tone: Tone
  compact?: boolean
  className?: string
}) {
  const t = toneClasses[tone]

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col rounded-xl border shadow-sm sm:rounded-2xl',
        compact ? 'p-2 max-[380px]:px-1.5 max-[380px]:py-1.5 sm:p-2.5' : 'p-3 sm:p-4',
        t.card,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-0.5 sm:gap-1">
        <p
          className={cn(
            'min-w-0 flex-1 font-semibold uppercase tracking-wide text-[#64748B]',
            compact ? 'text-[9px] leading-[1.15] sm:text-[10px]' : 'text-xs',
          )}
        >
          {compact && labelShort ? (
            <>
              <span className="max-sm:inline sm:hidden">{labelShort}</span>
              <span className="hidden sm:inline">{label}</span>
            </>
          ) : (
            label
          )}
        </p>
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg',
            compact ? 'size-5 rounded-md max-[380px]:size-[18px] sm:size-6' : 'size-8 rounded-xl',
            t.icon,
          )}
        >
          <Icon className={compact ? 'size-2.5 max-[380px]:size-[11px] sm:size-3' : 'size-4'} aria-hidden />
        </span>
      </div>
      <p
        className={cn(
          'min-w-0 font-bold tabular-nums tracking-tight',
          compact
            ? 'mt-0.5 text-[0.9375rem] leading-tight max-[380px]:text-sm sm:mt-1 sm:text-lg'
            : 'mt-2 text-2xl sm:text-3xl',
          t.value,
        )}
      >
        {value}
      </p>
    </div>
  )
}
