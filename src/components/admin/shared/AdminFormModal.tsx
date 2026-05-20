import { cloneElement, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type TriggerElement = ReactElement<{
  onClick?: (event: MouseEvent<HTMLElement>) => void
}>

export function AdminFormModal({
  trigger,
  title,
  description,
  descriptionClassName,
  children,
  open,
  onOpenChange,
  contentClassName,
}: {
  trigger?: TriggerElement
  title: string
  description?: string
  descriptionClassName?: string
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  contentClassName?: string
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = open !== undefined
  const currentOpen = isControlled ? open : internalOpen
  const setCurrentOpen = (nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <Dialog open={currentOpen} onOpenChange={setCurrentOpen}>
      {trigger
        ? cloneElement(trigger, {
            onClick: (event: MouseEvent<HTMLElement>) => {
              trigger.props.onClick?.(event)
              if (!event.defaultPrevented) setCurrentOpen(true)
            },
          })
        : null}
      <DialogContent className={cn('sm:max-w-lg gap-6 p-6 sm:p-7', contentClassName)}>
        <DialogHeader className="shrink-0 gap-1.5 space-y-0">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription className={cn('mt-0 text-muted-foreground', descriptionClassName)}>
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
