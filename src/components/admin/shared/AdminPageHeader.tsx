import type { ReactNode } from 'react'

export function AdminPageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 max-w-2xl flex-1">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1F5A4C]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-balance text-2xl font-semibold tracking-tight text-[#102A43] sm:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-pretty text-sm leading-6 text-[#64748B]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:max-w-xl lg:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
