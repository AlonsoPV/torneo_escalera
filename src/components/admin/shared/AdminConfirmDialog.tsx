import { cloneElement, useState, type MouseEvent, type ReactElement } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type TriggerElement = ReactElement<{
  onClick?: (event: MouseEvent<HTMLElement>) => void
}>

export function AdminConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirmar',
  onConfirm,
  disabled,
}: {
  trigger: TriggerElement
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {cloneElement(trigger, {
        onClick: (event: MouseEvent<HTMLElement>) => {
          trigger.props.onClick?.(event)
          if (!event.defaultPrevented) setOpen(true)
        },
      })}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={disabled}
            onClick={() => {
              onConfirm()
              setOpen(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
