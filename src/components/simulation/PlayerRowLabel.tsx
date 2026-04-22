import { cn } from '@/lib/utils'

type Props = {
  seed: number
  name: string
  className?: string
}

export function PlayerRowLabel(props: Props) {
  const { seed, name, className } = props
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-500/12 text-[11px] font-bold tabular-nums text-teal-800 dark:bg-teal-400/15 dark:text-teal-200"
        aria-hidden
      >
        {seed}
      </span>
      <span className="min-w-0 truncate text-left text-sm font-semibold leading-snug text-foreground">
        {name}
      </span>
    </div>
  )
}
