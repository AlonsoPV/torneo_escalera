import { Loader2, RotateCcw, Save, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function RulesActionsBar({
  onCancel,
  onReset,
  onSave,
  saving,
  disabled,
}: {
  onCancel: () => void
  onReset: () => void
  onSave: () => void
  saving: boolean
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        'max-xl:fixed max-xl:inset-x-0 max-xl:bottom-0 max-xl:z-40 max-xl:border-t max-xl:border-slate-200/90 max-xl:bg-white/95 max-xl:p-3 max-xl:px-4 max-xl:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-xl:pt-3 max-xl:shadow-[0_-10px_30px_rgba(15,23,42,0.12)]',
        'sm:max-xl:flex-row sm:max-xl:flex-wrap sm:max-xl:justify-end',
        'xl:mt-8 xl:flex xl:flex-row xl:flex-wrap xl:justify-end xl:gap-3 xl:border-t xl:border-slate-200/80 xl:pt-6',
      )}
    >
      <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" onClick={onCancel} disabled={saving || disabled}>
        <X className="size-4" />
        Cancelar cambios
      </Button>
      <Button type="button" variant="secondary" className="h-11 w-full sm:w-auto" onClick={onReset} disabled={saving || disabled}>
        <RotateCcw className="size-4" />
        Restaurar valores default
      </Button>
      <Button type="button" className="h-11 w-full sm:w-auto" onClick={onSave} disabled={saving || disabled}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Guardar reglas
      </Button>
    </div>
  )
}
