import { useState } from 'react'
import {
  BarChart3,
  ChevronDown,
  LogIn,
  LogOut,
  ShieldCheck,
  Trophy,
  UserCircle,
  UserRound,
} from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { signOut } from '@/lib/auth'
import { isAdminRole } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import type { Profile } from '@/types/database'

function initials(profile: Profile | null, fallbackEmail?: string | null): string {
  const name = profile?.full_name?.trim()
  if (!name && fallbackEmail) {
    return fallbackEmail.slice(0, 2).toUpperCase()
  }
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
    'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors sm:h-8 sm:px-2.5',
    'hover:bg-muted hover:text-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
  )

export function AppHeader() {
  const profile = useAuthStore((s) => s.profile)
  const session = useAuthStore((s) => s.session)
  const user = useAuthStore((s) => s.user)
  const [signingOut, setSigningOut] = useState(false)
  const navigate = useNavigate()
  const canAccessAdmin = profile ? isAdminRole(profile.role) : false
  const displayName = profile?.full_name?.trim() || profile?.email || user?.email || 'Cuenta'
  const emailHint = profile?.email ?? user?.email ?? null

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cerrar sesión')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top,0px)] shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto grid min-h-14 w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:gap-3 sm:px-4 md:gap-4 md:px-6">
        <Link
          to="/dashboard"
          className="group flex min-w-0 max-w-[min(100%,12rem)] shrink items-center gap-2 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring/50 sm:max-w-none sm:gap-2.5"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 shadow-sm transition-transform group-hover:scale-[1.02] dark:text-emerald-400">
            <Trophy className="size-[1.125rem]" aria-hidden />
          </span>
          <span className="hidden min-w-0 flex-col leading-none md:flex">
            <span className="truncate font-semibold tracking-tight text-foreground">
              Torneo Mega Varonil
            </span>
            <span className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
              Escalera varonil
            </span>
          </span>
          <span className="hidden min-w-0 truncate font-semibold leading-tight tracking-tight text-foreground sm:block md:hidden">
            Torneo MV
          </span>
        </Link>

        <div className="flex min-w-0 items-center justify-center gap-2 justify-self-stretch sm:justify-start">
          <Separator orientation="vertical" className="hidden h-7 shrink-0 sm:block" />
          <nav className="flex min-w-0 items-center justify-center gap-0.5 sm:justify-start sm:gap-1" aria-label="Principal">
            <NavLink
              to="/dashboard"
              className={navLinkClass}
              end={false}
              title="Dashboard del torneo"
              aria-label="Dashboard torneo"
            >
              <BarChart3 className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Dashboard torneo</span>
            </NavLink>
          </nav>
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-1.5 md:gap-2">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'h-9 max-w-[min(100%,14rem)] gap-1 pl-1 pr-1.5 data-[open]:bg-muted/80 sm:max-w-full sm:gap-1.5 sm:pr-2',
                )}
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
                  title={displayName}
                >
                  {initials(profile, emailHint)}
                </span>
                <span className="hidden min-w-0 max-w-[9rem] truncate text-sm font-medium sm:inline">
                  {displayName}
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="sr-only">Menú de cuenta</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52" sideOffset={6}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Tu cuenta</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => {
                      navigate('/player/cuenta')
                    }}
                    className="cursor-pointer"
                  >
                    <UserCircle className="size-4" />
                    Datos de cuenta
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      navigate('/player')
                    }}
                    className="cursor-pointer"
                  >
                    <UserRound className="size-4" />
                    Panel jugador
                  </DropdownMenuItem>
                  {canAccessAdmin ? (
                    <DropdownMenuItem
                      onClick={() => {
                        navigate('/admin/overview')
                      }}
                      className="cursor-pointer"
                    >
                      <ShieldCheck className="size-4" />
                      Admin
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={signingOut}
                  onClick={handleSignOut}
                  className="cursor-pointer"
                >
                  <LogOut className="size-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {!session ? (
            <Link
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-1.5 px-2.5 sm:px-3')}
              to="/login"
              aria-label="Entrar"
            >
              <LogIn className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Entrar</span>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  )
}
