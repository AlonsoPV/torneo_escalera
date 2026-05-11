import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { GroupPlayer, MatchRow } from '@/types/database'

const mockPlayers: GroupPlayer[] = [
  {
    id: 'mock-1',
    group_id: 'mock',
    user_id: 'mock-u1',
    display_name: 'Ana López',
    seed_order: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-2',
    group_id: 'mock',
    user_id: 'mock-u2',
    display_name: 'Bruno Ruiz',
    seed_order: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-3',
    group_id: 'mock',
    user_id: 'mock-u3',
    display_name: 'Carla Mina',
    seed_order: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-4',
    group_id: 'mock',
    user_id: 'mock-u4',
    display_name: 'Diego Paz',
    seed_order: 4,
    created_at: new Date().toISOString(),
  },
]

const mockMatches: MatchRow[] = [
  {
    id: 'm1',
    tournament_id: 'mock',
    group_id: 'mock',
    player_a_id: 'mock-1',
    player_b_id: 'mock-2',
    player_a_user_id: 'mock-u1',
    player_b_user_id: 'mock-u2',
    score_raw: [
      { a: 6, b: 2 },
      { a: 4, b: 6 },
      { a: 6, b: 4 },
    ],
    winner_id: 'mock-1',
    status: 'closed',
    result_type: 'normal',
    game_type: 'best_of_3',
    scheduled_date: null,
    scheduled_start_at: null,
    scheduled_end_at: null,
    location: null,
    confirmed_at: null,
    confirmed_by: null,
    score_submitted_by: null,
    score_submitted_at: null,
    opponent_confirmed_by: null,
    opponent_confirmed_at: null,
    admin_validated_by: null,
    admin_validated_at: null,
    closed_at: null,
    dispute_reason: null,
    admin_notes: null,
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    locked_at: new Date().toISOString(),
  },
]

export function TournamentMatrixMock() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Vista previa (mock) — crea grupos y jugadores reales en Admin para datos persistidos.
      </p>
      <div className="rounded-xl border bg-muted/20 p-2 opacity-90">
        <MockMatrixInner players={mockPlayers} matches={mockMatches} />
      </div>
    </div>
  )
}

function MockMatrixInner(props: { players: GroupPlayer[]; matches: MatchRow[] }) {
  const { players, matches } = props
  const map = new Map<string, MatchRow>()
  for (const m of matches) {
    const key =
      m.player_a_id < m.player_b_id
        ? `${m.player_a_id}:${m.player_b_id}`
        : `${m.player_b_id}:${m.player_a_id}`
    map.set(key, m)
  }

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'

  const fmt = (sets: { a: number; b: number }[]) =>
    sets.map((s) => `${s.a}-${s.b}`).join(', ')

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left text-muted-foreground">Jugador</th>
            {players.map((p) => (
              <th key={p.id} className="min-w-[4rem] px-1 py-2 text-center text-muted-foreground">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                  {initials(p.display_name)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((row) => (
            <tr key={row.id} className="border-t">
              <th className="px-2 py-2 text-left font-medium">{row.display_name}</th>
              {players.map((col) => {
                const isDiag = row.id === col.id
                const key =
                  row.id < col.id ? `${row.id}:${col.id}` : `${col.id}:${row.id}`
                const match = map.get(key)
                const sets =
                  match && row.id === match.player_a_id
                    ? match.score_raw
                    : match && row.id === match.player_b_id && match.score_raw
                      ? match.score_raw.map((s) => ({ a: s.b, b: s.a }))
                      : null
                return (
                  <td key={col.id} className="p-0.5">
                    {isDiag ? (
                      <div className="h-12 rounded-md bg-zinc-800/90" />
                    ) : (
                      <div
                        className={cn(
                          'flex h-12 flex-col items-center justify-center rounded-md border px-1 text-[10px]',
                          match?.status === 'closed' && 'border-emerald-500/40 bg-emerald-500/10',
                        )}
                      >
                        {sets && sets.length > 0 ? (
                          <span className="leading-tight">{fmt(sets)}</span>
                        ) : (
                          <span className="text-muted-foreground">Capturar</span>
                        )}
                        {match ? (
                          <Badge variant="outline" className="mt-0.5 h-4 px-1 text-[9px]">
                            {match.status}
                          </Badge>
                        ) : null}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
