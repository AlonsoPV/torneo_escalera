import type { TournamentMovementType } from '@/types/database'

export function tournamentMovementShortLabelEs(type: TournamentMovementType): string {
  switch (type) {
    case 'promote':
      return 'Subida de categoría'
    case 'stay':
      return 'Misma categoría'
    case 'demote':
      return 'Bajada de categoría'
    case 'capped_top':
      return 'División máxima (tope)'
    case 'capped_bottom':
      return 'División mínima (tope)'
    default:
      return type
  }
}
