import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { tournamentPath } from '@/lib/tournamentUrl'
import { cn } from '@/lib/utils'
import type { CreateNextTournamentWithProgressResult } from '@/services/nextTournamentFromPrevious'

export function NextTournamentSuccessSummary({
  result,
  onCreateAnother,
}: {
  result: CreateNextTournamentWithProgressResult
  onCreateAnother: () => void
}) {
  const { tournament, partialFailure, groupErrors, movementSaveError } = result

  return (
    <Card
      className={cn(
        'rounded-2xl border-slate-200/80 shadow-sm',
        partialFailure && 'border-amber-200/90',
      )}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-2xl',
              partialFailure ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700',
            )}
          >
            {partialFailure ? (
              <AlertTriangle className="size-6" />
            ) : (
              <CheckCircle2 className="size-6" />
            )}
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-xl text-[#102A43]">
              {partialFailure ? 'Proceso finalizado con incidencias' : 'Torneo siguiente creado'}
            </CardTitle>
            <CardDescription className="text-pretty">
              {tournament.name}
              {tournament.period_label ? ` · ${tournament.period_label}` : ''}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-700">
        {partialFailure ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-950">
            <p className="font-medium">El torneo fue creado, pero algunos pasos no se completaron correctamente.</p>
            <p className="mt-1 text-xs opacity-90">
              Revisa los errores abajo y usa Grupos o Partidos para corregir lo que falte.
            </p>
          </div>
        ) : null}

        <ul className="list-inside list-disc space-y-1 text-pretty">
          <li>{result.groupsCreated} grupo(s) creado(s)</li>
          <li>{result.playersAssigned} jugador(es) asignado(s)</li>
          <li>{result.matchesInserted} partido(s) generado(s)</li>
          <li>
            {result.fullGroupsWithMatches} grupo(s) completo(s) con cruces; {result.incompleteGroups} incompleto(s)
          </li>
          <li>
            {result.movementsRecorded} movimiento(s) en historial
            {movementSaveError ? (
              <span className="font-medium text-red-700"> (error: {movementSaveError})</span>
            ) : null}
          </li>
        </ul>

        {groupErrors.length > 0 ? (
          <div className="rounded-xl border border-red-100 bg-red-50/50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-900">Errores por grupo u operación</p>
            <ul className="mt-2 space-y-1.5 text-sm text-red-900">
              {groupErrors.map((e) => (
                <li key={`${e.tempId}-${e.message}`}>
                  <span className="font-medium">{e.name}:</span> {e.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            className={cn(
              'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-white',
              'bg-[#1F5A4C] hover:bg-[#1F5A4C]/90',
            )}
            to={`/admin/groups?tournament=${tournament.id}`}
          >
            Gestionar grupos del nuevo torneo
          </Link>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-[#102A43] hover:bg-slate-50"
            to={tournamentPath(tournament)}
          >
            Ver nuevo torneo
          </Link>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-[#102A43] hover:bg-slate-50"
            to="/admin/matches"
          >
            Ver partidos generados
          </Link>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-[#102A43] hover:bg-slate-50"
            to="/admin/overview"
          >
            Ir a dashboard admin
          </Link>
          <Button type="button" variant="ghost" className="h-10 sm:ml-auto" onClick={onCreateAnother}>
            Crear otro
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
