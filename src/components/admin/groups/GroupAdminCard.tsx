import { Users } from 'lucide-react'

import { AdminStatusBadge } from '@/components/admin/shared/AdminStatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminGroupRecord } from '@/services/admin'

function getGroupStatus(group: AdminGroupRecord) {
  if (group.players.length === 0) return 'empty'
  if (group.players.length >= group.max_players) return 'complete'
  return 'incomplete'
}

export function GroupAdminCard({
  group,
  onManage,
}: {
  group: AdminGroupRecord
  onManage: (group: AdminGroupRecord) => void
}) {
  const generated = group.matches.length > 0

  return (
    <Card className="border-[#E2E8F0] bg-white shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pr-2">
            <CardTitle className="text-balance text-lg text-[#102A43]">{group.name}</CardTitle>
            {group.tournament?.name ? (
              <p className="mt-1 text-sm text-[#64748B]">{group.tournament.name}</p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-2xl bg-[#F6F3EE] p-3 text-[#1F5A4C]">
            <Users className="size-5" />
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminStatusBadge status={getGroupStatus(group)} />
          {generated ? <AdminStatusBadge status="generated" /> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-[#64748B]">Jugadores</span>
            <span className="font-medium text-[#102A43]">
              {group.players.length} / {group.max_players}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#1F5A4C]"
              style={{ width: `${Math.min(100, (group.players.length / group.max_players) * 100)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#64748B]">Partidos</span>
          <span className="font-medium text-[#102A43]">{group.matches.length}</span>
        </div>
        <Button variant="outline" className="w-full" onClick={() => onManage(group)}>
          Gestionar grupo
        </Button>
      </CardContent>
    </Card>
  )
}
