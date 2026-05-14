import { ArrowLeft, UserCircle } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { PlayerAccountSection } from '@/components/player/PlayerAccountSection'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

export function PlayerAccountPage() {
  const profile = useAuthStore((s) => s.profile)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  return (
    <div id="page-player-account" className="mx-auto max-w-lg space-y-5 py-2 sm:py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/player"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex gap-2')}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Panel jugador
        </Link>
      </div>

      <div className="flex items-center gap-2 text-[#102A43]">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[#1F5A4C]/10 text-[#1F5A4C]">
          <UserCircle className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Datos de cuenta</h1>
          <p className="text-sm text-[#64748B]">Correo de recuperación y contraseña</p>
        </div>
      </div>

      {!profile ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : (
        <PlayerAccountSection profile={profile} />
      )}
    </div>
  )
}
