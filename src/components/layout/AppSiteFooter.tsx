import { ExternalLink } from 'lucide-react'

import { cn } from '@/lib/utils'

const EMOTION_SITES_URL = 'https://emotionsites.com/'

export function AppSiteFooter({
  className,
  variant = 'default',
}: {
  className?: string
  variant?: 'default' | 'auth'
}) {
  return (
    <footer
      className={cn(
        'shrink-0 py-3 sm:py-4',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        variant === 'default' && 'border-t border-border/20 bg-background/80 backdrop-blur-sm',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl justify-center px-4 sm:px-5 md:px-6">
        <a
          href={EMOTION_SITES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'group inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] leading-none shadow-sm transition-all duration-200 sm:gap-2.5 sm:px-3.5 sm:py-2 sm:text-xs',
            variant === 'auth'
              ? 'border-border/35 bg-background/55 text-muted-foreground backdrop-blur-md hover:border-border/55 hover:bg-background/75 hover:shadow-md'
              : 'border-border/40 bg-muted/25 text-muted-foreground hover:border-emerald-500/25 hover:bg-emerald-500/[0.04] hover:shadow-md',
          )}
          aria-label="Hecho por eMotion Sites — abrir sitio web"
        >
          <span className="truncate font-normal tracking-wide">Hecho por</span>
          <span
            className={cn(
              'truncate font-semibold tracking-tight transition-colors',
              'text-foreground/85 group-hover:text-emerald-800 dark:group-hover:text-emerald-300',
            )}
          >
            eMotion Sites
          </span>
          <ExternalLink
            className="size-3 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-600/80 dark:group-hover:text-emerald-400/80"
            aria-hidden
          />
        </a>
      </div>
    </footer>
  )
}
