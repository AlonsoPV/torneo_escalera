import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MatchStatus, TournamentStatus, UserRole } from '@/types/database'

type StatusValue = MatchStatus | TournamentStatus | UserRole | 'complete' | 'incomplete' | 'empty' | 'generated'

const labels: Record<string, string> = {
  pending: 'Pendiente',
  scheduled: 'Programado',
  ready_for_result: 'Listo para marcador',
  result_submitted: 'Resultado enviado',
  confirmed: 'Confirmado',
  corrected: 'Corregido',
  cancelled: 'Cancelado',
  draft: 'Borrador',
  active: 'Activo',
  finished: 'Finalizado',
  player: 'Jugador',
  admin: 'Admin',
  super_admin: 'Super admin',
  captain: 'Capitán',
  referee: 'Árbitro',
  complete: 'Completo',
  incomplete: 'Incompleto',
  empty: 'Sin jugadores',
  generated: 'Partidos',
}

const tones: Record<string, string> = {
  scheduled: 'border-blue-200 bg-blue-50 text-blue-700',
  ready_for_result: 'border-amber-200 bg-amber-50 text-amber-700',
  result_submitted: 'border-blue-200 bg-blue-50 text-blue-700',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  corrected: 'border-purple-200 bg-purple-50 text-purple-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  finished: 'border-slate-200 bg-slate-50 text-slate-700',
  admin: 'border-[#C8A96B]/40 bg-[#C8A96B]/15 text-[#6E5521]',
  super_admin: 'border-[#1F5A4C]/30 bg-[#1F5A4C]/10 text-[#1F5A4C]',
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  incomplete: 'border-amber-200 bg-amber-50 text-amber-700',
  empty: 'border-slate-200 bg-slate-50 text-slate-600',
  generated: 'border-blue-200 bg-blue-50 text-blue-700',
}

export function AdminStatusBadge({ status, className }: { status: StatusValue; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('rounded-full border px-2.5 py-1 font-medium', tones[status] ?? '', className)}
    >
      {labels[status] ?? status}
    </Badge>
  )
}

