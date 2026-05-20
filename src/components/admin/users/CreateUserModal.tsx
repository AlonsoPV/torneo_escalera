import { UserPlus } from 'lucide-react'
import { useState } from 'react'

import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
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
import { ADMIN_USER_ASSIGNABLE_ROLES, userRoleLabelEs } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { Group, PlayerCategory, UserRole } from '@/types/database'

const fieldCn = 'h-9 rounded-md text-sm md:text-[13px]'

export function CreateUserModal({
  groups,
  categories,
  onSubmit,
  triggerClassName,
}: {
  groups: Group[]
  categories: PlayerCategory[]
  triggerClassName?: string
  onSubmit: (values: {
    fullName: string
    phone: string
    temporaryPassword: string
    role: UserRole
    categoryId: string
    groupId?: string
    tournamentId?: string | null
  }) => void
}) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [role, setRole] = useState<UserRole>('player')
  const [categoryId, setCategoryId] = useState(() => categories[0]?.id ?? '')
  const [groupId, setGroupId] = useState('none')

  return (
    <AdminFormModal
      trigger={
        <Button
          type="button"
          size="lg"
          className={cn(
            'h-11 w-full gap-2 bg-[#1F5A4C] text-white shadow-sm hover:bg-[#174a3f] sm:w-auto sm:min-w-[12rem]',
            triggerClassName,
          )}
        >
          <UserPlus className="size-4 shrink-0" aria-hidden />
          Agregar usuario
        </Button>
      }
      title="Usuario único"
      description="Celular = usuario de entrada. Contraseña temporal: comunícala fuera del sistema."
      descriptionClassName="text-xs leading-snug text-muted-foreground"
      contentClassName={cn(
        'max-h-[min(92svh,640px)] w-[min(calc(100vw-2rem),42rem)] gap-3 p-4 sm:flex sm:max-w-none sm:flex-col sm:overflow-hidden sm:p-5',
        'lg:w-[min(calc(100vw-3rem),56rem)]',
      )}
    >
      <form
        className="flex min-h-0 flex-1 flex-col gap-0 sm:flex-1 sm:flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          const gid = groupId === 'none' ? undefined : groupId
          const selectedGroup = gid ? groups.find((g) => g.id === gid) : undefined
          onSubmit({
            fullName,
            phone,
            temporaryPassword,
            role,
            categoryId,
            groupId: gid,
            tournamentId: selectedGroup?.tournament_id ?? null,
          })
        }}
      >
        {/* Cuerpo: prioridad ver todo en escritorio sin scroll (2 cols); scroll solo si falta alto */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-8 gap-y-3 overflow-y-auto overscroll-contain lg:grid-cols-2 lg:items-start lg:gap-y-2.5">
          <section className="space-y-2 lg:col-span-2 lg:border-b lg:border-border/45 lg:pb-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              <div className="space-y-1 sm:col-span-1">
                <Label htmlFor="create-full-name" className="text-xs">
                  Nombre completo
                </Label>
                <Input
                  id="create-full-name"
                  className={fieldCn}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ana Martínez López"
                  autoComplete="name"
                  required
                />
              </div>
              <div className="space-y-1 sm:col-span-1">
                <Label htmlFor="create-phone" className="text-xs">
                  Celular <span className="font-normal text-muted-foreground">(acceso)</span>
                </Label>
                <Input
                  id="create-phone"
                  className={fieldCn}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="5512345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>
          </section>

          <section className="space-y-1.5 lg:col-span-1 lg:border-r lg:border-border/45 lg:pr-6">
            <Label htmlFor="create-password" className="text-xs">
              Contraseña temporal
            </Label>
            <Input
              id="create-password"
              className={fieldCn}
              type="password"
              autoComplete="new-password"
              placeholder="Inicial obligatoria"
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              required
            />
            <p className="text-[11px] leading-snug text-muted-foreground">Podrá cambiarla desde el perfil o recuperación cuando tenga correo.</p>
          </section>

          <section className="grid gap-2.5 lg:col-span-1">
            <div className="space-y-1">
              <Label className="text-xs">Rol</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger className={cn(fieldCn, 'w-full bg-background')}>
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_USER_ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r} label={userRoleLabelEs(r)}>
                      {userRoleLabelEs(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoría</Label>
              <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? '')}>
                <SelectTrigger className={cn(fieldCn, 'w-full bg-background')}>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} label={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Grupo</Label>
              <Select value={groupId} onValueChange={(value) => setGroupId(value ?? 'none')}>
                <SelectTrigger className={cn(fieldCn, 'w-full bg-background')}>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" label="Sin grupo">
                    Sin grupo
                  </SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id} label={group.name}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-border/50 pt-3 mt-2.5 sm:mt-3">
          <Button
            type="submit"
            className="h-10 w-full gap-2 bg-[#1F5A4C] hover:bg-[#174a3f] sm:h-10"
            disabled={!categoryId}
          >
            <UserPlus className="size-4" aria-hidden />
            Crear usuario
          </Button>
        </div>
      </form>
    </AdminFormModal>
  )
}
