import type { LucideIcon } from 'lucide-react'
import { createElement, isValidElement, type ElementType, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type AdminMetricTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

/** Grid recomendado: 1 col compacta en móvil, 2 en tablet, 4 en desktop ancho. */
export const ADMIN_METRIC_GRID_4 =
  'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-5'

/** Variante con 3 columnas en xl (p. ej. bloque de resumen con 3 KPIs). */
export const ADMIN_METRIC_GRID_3 =
  'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 xl:gap-5'

/** Tarjeta de métrica admin: fila compacta tipo “stat” en todos los breakpoints; grid define columnas. */
export type AdminMetricCardProps = {
  /** Identificador estable para la tarjeta (pruebas / automatización). */
  id?: string
  label: string
  value: string | number
  /** Ícono como componente Lucide o nodo React. */
  icon?: LucideIcon | ReactNode
  tone?: AdminMetricTone | 'pending'
  description?: string
  /** Texto auxiliar (alias de `description`). */
  helper?: string
  trend?: string
  /** Modo aún más denso (listados secundarios). */
  compact?: boolean
  className?: string
}

const toneIcon: Record<AdminMetricTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-blue-100 text-blue-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
}

function normalizeTone(tone: AdminMetricCardProps['tone']): AdminMetricTone {
  if (tone === 'pending') return 'info'
  return tone ?? 'neutral'
}

function renderIcon(icon: LucideIcon | ReactNode | undefined): ReactNode {
  if (icon == null) return null
  if (isValidElement(icon)) return icon
  if (typeof icon === 'string' || typeof icon === 'number') return icon
  return createElement(icon as ElementType, {
    className: 'size-5 shrink-0',
    'aria-hidden': true,
  })
}

export function AdminMetricCard({
  id,
  label,
  value,
  icon,
  tone = 'neutral',
  description,
  helper,
  trend,
  compact,
  className,
}: AdminMetricCardProps) {
  const t = normalizeTone(tone)
  const desc = description ?? helper

  return (
    <div
      id={id}
      className={cn(
        'rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-shadow sm:transition-all',
        'hover:shadow-md sm:hover:-translate-y-0.5 sm:hover:shadow-md',
        compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5',
        className,
      )}
    >
      <div className={cn('flex items-center justify-between', compact ? 'gap-2.5 sm:gap-3' : 'gap-3 sm:gap-4')}>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-snug text-slate-500 sm:text-sm">{label}</p>
          <div className="mt-0.5 flex items-end gap-2 sm:mt-1">
            <p
              className={cn(
                'font-bold tabular-nums tracking-tight text-slate-950',
                compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
              )}
            >
              {value}
            </p>
          </div>
          {desc ? (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400 sm:mt-1 sm:text-xs sm:leading-relaxed">
              {desc}
            </p>
          ) : null}
          {trend ? (
            <p className="mt-0.5 text-[10px] font-medium uppercase leading-snug tracking-wide text-slate-400 sm:mt-1 sm:text-[11px]">
              {trend}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:h-11 sm:w-11 [&_svg]:size-[1.05rem] sm:[&_svg]:size-5',
              toneIcon[t],
            )}
          >
            {renderIcon(icon)}
          </div>
        ) : null}
      </div>
    </div>
  )
}
