export const MATCH_FORMAT_LABEL: Record<string, string> = {
  one_set: '1 set',
  best_of_3: '2 de 3 sets',
  best_of_5: '3 de 5 sets',
}

export const SET_TYPE_LABEL: Record<string, string> = {
  long_set: 'Set largo',
  short_set: 'Set corto',
  tiebreak_set: 'Set con tie-break',
  pro_set: 'Set profesional (pro set)',
}

export const FINAL_SET_LABEL: Record<string, string> = {
  full_set: 'Set completo',
  sudden_death: 'Muerte súbita',
  super_tiebreak: 'Super tie-break',
  none: 'No aplica',
}

export function tiebreakAtLabel(at: number | null | undefined, enabled: boolean): string {
  if (!enabled || at == null) return 'No aplica'
  if (at === 6) return 'Tie-break en 6-6'
  if (at === 5) return 'Tie-break en 5-5'
  return String(at)
}

export function suddenDeathLabel(pts: number): string {
  return `${pts} puntos`
}
