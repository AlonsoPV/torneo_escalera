import { CalendarClock, Shield } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Tournament, TournamentRules } from '@/types/database'

export function RulesSummaryCard({
  tournament,
  tournaments,
  onTournamentChange,
  rules,
}: {
  tournament: Tournament
  tournaments: Tournament[]
  onTournamentChange: (id: string) => void
  rules: TournamentRules | null
}) {
  const updatedAt = rules?.updated_at ?? rules?.created_at
  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'
  const updatedByLabel = rules?.updated_by ? `${rules.updated_by.slice(0, 8)}…` : '—'

  const rulesBadge =
    tournament.status === 'draft' ? (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
        Pendientes de publicar
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-emerald-50 text-emerald-900">
        Reglas configuradas
      </Badge>
    )

  return (
    <Card id="card-rules-summary" className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg font-semibold text-slate-900">Resumen</CardTitle>
          {rulesBadge}
        </div>
        <CardDescription className="text-sm leading-relaxed text-slate-600">
          Estas reglas se aplicarán al cálculo de ranking, resultados y clasificación del torneo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <div className="space-y-2">
          <Label htmlFor="rules-summary-tournament-select" className="text-xs font-medium text-slate-600">
            Torneo actual
          </Label>
          <Select
            value={tournament.id}
            onValueChange={(value) => {
              if (value) onTournamentChange(value)
            }}
          >
            <SelectTrigger id="rules-summary-tournament-select" className="h-11 min-w-[200px] max-w-[280px] w-auto">
              <SelectValue placeholder="Selecciona un torneo">{tournament.name}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tournaments.map((t) => (
                <SelectItem key={t.id} value={t.id} label={t.name}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden />
            <div>
              <p className="text-xs font-medium text-slate-500">Última actualización</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{updatedLabel}</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <Shield className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden />
            <div>
              <p className="text-xs font-medium text-slate-500">Actualizado por</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{updatedByLabel}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
