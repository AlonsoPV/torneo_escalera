import { Link } from 'react-router-dom'

import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/shared/AdminDataTable'
import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { tournamentPathFromIdAndName } from '@/lib/tournamentUrl'
import type { AdminMatchRecord } from '@/services/admin'

function tournamentLink(m: AdminMatchRecord) {
  return tournamentPathFromIdAndName(m.tournament_id, m.tournamentName)
}

function formatScore(match: AdminMatchRecord) {
  return match.score_raw?.map((set) => `${set.a}-${set.b}`).join(', ') ?? 'Sin marcador'
}

function registeredAt(match: AdminMatchRecord) {
  if (!match.score_submitted_at) return 'Sin registro'
  const d = new Date(match.score_submitted_at)
  if (Number.isNaN(d.getTime())) return 'Sin registro'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export function AdminMatchTable({
  matches,
  onEditResult,
}: {
  matches: AdminMatchRecord[]
  onEditResult?: (match: AdminMatchRecord) => void
}) {
  const columns: AdminDataTableColumn<AdminMatchRecord>[] = [
    { key: 'group', header: 'Grupo', render: (match) => match.groupName },
    { key: 'a', header: 'Jugador 1', render: (match) => match.playerAName },
    { key: 'b', header: 'Jugador 2', render: (match) => match.playerBName },
    { key: 'status', header: 'Estado', render: (match) => <AdminStatusBadge status={match.status} /> },
    { key: 'score', header: 'Resultado', render: formatScore },
    { key: 'registered', header: 'Registrado el', render: registeredAt },
    {
      key: 'actions',
      header: 'Acciones',
      render: (match) => (
        <div className="flex gap-2">
          <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={tournamentLink(match)}>
            Ver detalle
          </Link>
          {onEditResult ? (
            <Button variant="outline" size="sm" onClick={() => onEditResult(match)}>
              Editar resultado
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="hidden md:block">
        <AdminDataTable rows={matches} columns={columns} getRowKey={(match) => match.id} />
      </div>
      <div className="grid gap-3 md:hidden">
        {matches.map((match) => (
          <Card key={match.id} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-pretty text-sm font-semibold text-[#102A43]">
                    {match.playerAName} vs {match.playerBName}
                  </p>
                  <p className="text-xs text-[#64748B]">{match.groupName}</p>
                </div>
                <div className="shrink-0">
                  <AdminStatusBadge status={match.status} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#64748B]">Resultado</p>
                  <p className="font-medium text-[#102A43]">{formatScore(match)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">Registrado el</p>
                  <p className="font-medium text-[#102A43]">{registeredAt(match)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={tournamentLink(match)}>
                  Ver detalle
                </Link>
                {onEditResult ? (
                  <Button variant="outline" size="sm" onClick={() => onEditResult(match)}>
                    Editar resultado
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
