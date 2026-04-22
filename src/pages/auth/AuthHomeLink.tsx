import { Home } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

export function AuthHomeLink({ className }: Props) {
  return (
    <Link
      to="/"
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'gap-2 border-border/80 bg-background/80 shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <Home className="size-4 shrink-0" aria-hidden />
      Inicio
    </Link>
  )
}
