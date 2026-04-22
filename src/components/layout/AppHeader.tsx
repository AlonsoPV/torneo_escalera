import { useState } from 'react'
import {
  LogIn,
  LogOut,
  Trophy,
  UserPlus,
  Grid3x3,
  UserCircle2,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { signOut } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import type { Profile } from '@/types/database'

function initials(profile: Profile | null): string {
  const name = profile?.full_name?.trim()
  if (!name) return '?'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0]?.[0]
    const b = parts[parts.length - 1]?.[0]
    if (a && b) return (a + b).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors',
    'hover:bg-muted hover:text-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
  )

export function AppHeader() {
  const profile = useAuthStore((s) => s.profile)
  const session = useAuthStore((s) => s.session)
  const [signingOut, setSigningOut] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-3 sm:gap-4 sm:px-4">
        <Link
          to={session ? '/player' : '/simulation'}
          className="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 shadow-sm transition-transform group-hover:scale-[1.02] dark:text-emerald-400">
            <Trophy className="size-[1.125rem]" aria-hidden />
          </span>
          <span className="hidden min-w-0 flex-col leading-none sm:flex">
            <span className="truncate font-semibold tracking-tight text-foreground">
              Torneo Mega Varonil
            </span>
            <span className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
              Escalera varonil
            </span>
          </span>
        </Link>

        <Separator orientation="vertical" className="hidden h-7 sm:block" />

        <nav
          className="flex min-w-0 flex-1 items-center justify-center gap-0.5 sm:justify-start md:gap-1"
          aria-label="Principal"
        >
          {session ? (
            <NavLink to="/player" className={navLinkClass}>
              <UserCircle2 className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Mi torneo</span>
            </NavLink>
          ) : null}
          <NavLink to="/simulation" className={navLinkClass}>
            <Grid3x3 className="size-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Demo</span>
          </NavLink>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {session ? (
            <>
              {profile?.full_name ? (
                <div
                  className="hidden max-w-[10rem] items-center gap-2 md:flex"
                  title={profile.full_name}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(profile)}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {profile.full_name}
                  </span>
                </div>
              ) : (
                <span
                  className="hidden size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground md:flex"
                  aria-hidden
                >
                  {initials(profile)}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={signingOut}
                onClick={async () => {
                  setSigningOut(true)
                  try {
                    await signOut()
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'No se pudo cerrar sesión')
                  } finally {
                    setSigningOut(false)
                  }
                }}
              >
                <LogOut className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Salir</span>
              </Button>
            </>
          ) : (
            <>
              <Link
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5')}
                to="/login"
              >
                <LogIn className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Entrar</span>
              </Link>
              <Link
                className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-1.5')}
                to="/register"
              >
                <UserPlus className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Registro</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
