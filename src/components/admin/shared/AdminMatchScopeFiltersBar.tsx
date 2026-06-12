import type { LucideIcon } from 'lucide-react'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type AdminScopeFilterSelectConfig = {
  /** Clave estable para React (ej. torneo, grupo). */
  id: string
  label: string
  icon?: LucideIcon
  value: string
  onValueChange: (value: string | null) => void
  items: { value: string; label: string }[]
  placeholder?: string
  /**
   * Texto fijo en el trigger (evita UUID cuando el valor no resuelve bien contra los ítems).
   */
  valueLabel?: string
  triggerTitle?: string
}

type Props = {
  heading?: string
  description?: string
  search: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    ariaLabel: string
  }
  selects: AdminScopeFilterSelectConfig[]
  onClear: () => void
  clearLabel?: string
}

export function AdminMatchScopeFiltersBar({
  heading = 'Filtros',
  description,
  search,
  selects,
  onClear,
  clearLabel = 'Limpiar',
}: Props) {
  const n = selects.length

  return (
    <section className="space-y-3" aria-labelledby="admin-scope-filters-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-0.5">
          <h2 id="admin-scope-filters-heading" className="text-base font-semibold tracking-tight text-[#102A43]">
            {heading}
          </h2>
          {description ? <p className="text-xs leading-relaxed text-slate-500">{description}</p> : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 sm:self-center"
          onClick={onClear}
        >
          {clearLabel}
        </Button>
      </div>

      <div
        className={cn(
          'rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-sm',
          'ring-1 ring-slate-900/[0.04]',
          'sm:p-5',
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              className="h-10 border-slate-200 bg-slate-50/50 pl-10 text-sm transition-colors placeholder:text-slate-400 focus-visible:bg-white"
              placeholder={search.placeholder}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              aria-label={search.ariaLabel}
            />
          </div>

          <div
            className={cn(
              'grid min-w-0 gap-3',
              n <= 2 && 'grid-cols-1 sm:grid-cols-2 sm:gap-4',
              n === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4',
              n >= 4 && 'grid-cols-2 md:grid-cols-2 lg:grid-cols-4 lg:gap-4',
            )}
          >
            {selects.map((field) => {
              const Icon = field.icon
              return (
                <div key={field.id} className="min-w-0 space-y-1.5">
                  <Label
                    htmlFor={`admin-filter-${field.id}`}
                    className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {Icon ? <Icon className="size-3 shrink-0 opacity-70" aria-hidden /> : null}
                    {field.label}
                  </Label>
                  <Select value={field.value} onValueChange={field.onValueChange}>
                    <SelectTrigger
                      id={`admin-filter-${field.id}`}
                      title={field.triggerTitle}
                      className="h-10 w-full min-w-0 border-slate-200 bg-white text-left text-sm font-normal shadow-none"
                    >
                      <SelectValue placeholder={field.placeholder ?? field.label}>
                        {field.valueLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {field.items.map((item) => (
                        <SelectItem key={item.value} value={item.value} label={item.label}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
