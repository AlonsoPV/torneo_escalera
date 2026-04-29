import { useState } from 'react'

import { AdminFormModal } from '@/components/admin/shared/AdminFormModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AdminMatchRecord } from '@/services/admin'
import type { ScoreSet } from '@/types/database'

function ScoreEditorForm({
  match,
  onSubmit,
}: {
  match: AdminMatchRecord
  onSubmit: (match: AdminMatchRecord, sets: ScoreSet[]) => void
}) {
  const initialSets = match.score_raw?.length ? match.score_raw : [{ a: 0, b: 0 }]
  const [sets, setSets] = useState<ScoreSet[]>(initialSets)

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(match, sets.filter((set) => Number.isFinite(set.a) && Number.isFinite(set.b)))
      }}
    >
      <div className="space-y-3">
        {sets.map((set, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor={`set-${index}-a`}>Set {index + 1} A</Label>
              <Input
                id={`set-${index}-a`}
                type="number"
                min={0}
                value={set.a}
                onChange={(event) => {
                  const next = [...sets]
                  next[index] = { ...set, a: Number(event.target.value) }
                  setSets(next)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`set-${index}-b`}>Set {index + 1} B</Label>
              <Input
                id={`set-${index}-b`}
                type="number"
                min={0}
                value={set.b}
                onChange={(event) => {
                  const next = [...sets]
                  next[index] = { ...set, b: Number(event.target.value) }
                  setSets(next)
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={sets.length === 1}
              onClick={() => setSets(sets.filter((_, setIndex) => setIndex !== index))}
            >
              Quitar
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={() => setSets([...sets, { a: 0, b: 0 }])}>
          Agregar set
        </Button>
        <Button type="submit">Guardar corrección</Button>
      </div>
    </form>
  )
}

export function ScoreEditorModal({
  match,
  open,
  onOpenChange,
  onSubmit,
}: {
  match: AdminMatchRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (match: AdminMatchRecord, sets: ScoreSet[]) => void
}) {
  if (!match) return null

  return (
    <AdminFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Corregir marcador"
      description={`${match.playerAName} vs ${match.playerBName}`}
    >
      <ScoreEditorForm key={match.id} match={match} onSubmit={onSubmit} />
    </AdminFormModal>
  )
}
