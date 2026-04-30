import type { ComponentProps, ReactNode } from 'react'
import type { FieldError } from 'react-hook-form'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function RulesSectionCard({
  id,
  title,
  description,
  children,
  className,
}: {
  id?: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card id={id} className={cn('rounded-2xl border border-slate-200/80 bg-white shadow-sm', className)}>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
        {description ? <CardDescription className="text-xs leading-relaxed sm:text-sm">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">{children}</CardContent>
    </Card>
  )
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-slate-500">{children}</p>
}

export function FieldErrorText({ error }: { error?: FieldError }) {
  if (!error?.message) return null
  return <p className="text-xs font-medium text-red-600">{error.message}</p>
}

export function NumberFieldRow({
  label,
  hint,
  error,
  suffix = 'pts',
  inputId,
  inputProps,
}: {
  label: string
  hint: string
  error?: FieldError
  suffix?: string
  inputId: string
  inputProps: ComponentProps<'input'>
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={inputId} className="text-sm font-medium text-slate-800">
            {label}
          </Label>
          <FieldHint>{hint}</FieldHint>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Input
            id={inputId}
            type="number"
            inputMode="numeric"
            className="h-10 w-20 text-center tabular-nums sm:w-24"
            {...inputProps}
          />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{suffix}</span>
        </div>
      </div>
      <FieldErrorText error={error} />
    </div>
  )
}

export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  label: ReactNode
  description?: string
  checked: boolean
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
  id: string
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white px-3 py-3 sm:px-4',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-sm font-medium text-slate-900">{label}</div>
        {description && description.trim() ? <p className="text-xs text-slate-500">{description}</p> : null}
      </div>
      <div className="shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="sr-only"
        />
        <span
          aria-hidden
          className={cn(
            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
            checked ? 'bg-emerald-600' : 'bg-slate-200',
          )}
        >
          <span
            className={cn(
              'inline-block size-6 rounded-full bg-white shadow transition-transform',
              checked ? 'translate-x-[1.35rem]' : 'translate-x-0.5',
            )}
          />
        </span>
      </div>
    </label>
  )
}
