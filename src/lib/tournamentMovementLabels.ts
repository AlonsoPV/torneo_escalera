import type { TournamentMovementReason, TournamentMovementType } from '@/types/database'

export function tournamentMovementPreviewLabelEs(
  reason: TournamentMovementReason | null | undefined,
  type: TournamentMovementType,
): string {
  switch (reason) {
    case 'top_2_promote':
      return 'Sube'
    case 'third_stays':
      return 'Se queda'
    case 'bottom_2_demote':
      return 'Baja'
    case 'top_group_limit':
      return 'Se mantiene por límite superior'
    case 'bottom_group_limit':
      return 'Se mantiene por límite inferior'
    default:
      return tournamentMovementShortLabelEs(type)
  }
}

export function tournamentMovementShortLabelEs(type: TournamentMovementType): string {
  switch (type) {
    case 'promote':
      return 'Sube de nivel de grupo'
    case 'stay':
      return 'Mismo nivel'
    case 'demote':
      return 'Baja de nivel de grupo'
    case 'capped_top':
      return 'Nivel máximo (tope)'
    case 'capped_bottom':
      return 'Nivel mínimo (tope)'
    default:
      return type
  }
}
