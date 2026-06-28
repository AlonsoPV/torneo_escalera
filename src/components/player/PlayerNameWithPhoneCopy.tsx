import { Smartphone } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

async function copyPhoneToClipboard(phone: string, displayName: string) {
  const normalizedPhone = phone.trim()
  if (!normalizedPhone) return

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard API unavailable')
    }
    await navigator.clipboard.writeText(normalizedPhone)
    toast.success('Celular copiado', {
      description: `${displayName}: ${normalizedPhone}`,
    })
  } catch {
    toast.error('No se pudo copiar el celular', {
      description: normalizedPhone,
    })
  }
}

export function PlayerNameWithPhoneCopy({
  name,
  phone,
  prefix,
  className,
  nameClassName,
}: {
  name: string
  phone?: string | null
  prefix?: string
  className?: string
  nameClassName?: string
}) {
  const displayName = name.trim() || 'Jugador'
  const normalizedPhone = phone?.trim() ?? ''
  const hasPhone = normalizedPhone.length > 0

  return (
    <span className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle', className)}>
      <span className={cn('min-w-0 truncate', nameClassName)} title={displayName}>
        {prefix ? `${prefix} ${displayName}` : displayName}
      </span>
      <button
        type="button"
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/30',
          hasPhone
            ? 'border-emerald-200 bg-emerald-50 text-[#1F5A4C] shadow-sm hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900'
            : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300',
        )}
        disabled={!hasPhone}
        title={hasPhone ? `Copiar celular: ${normalizedPhone}` : 'Sin celular registrado'}
        aria-label={hasPhone ? `Copiar celular de ${displayName}` : `${displayName} no tiene celular registrado`}
        onClick={(event) => {
          event.stopPropagation()
          void copyPhoneToClipboard(normalizedPhone, displayName)
        }}
      >
        <Smartphone className="size-3.5" aria-hidden />
      </button>
    </span>
  )
}
