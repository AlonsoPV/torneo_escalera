import type { ChangeEventHandler } from 'react'

/**
 * Input numérico para games/puntos de tenis.
 * El 0 se muestra como "0" (no como vacío): si no, al escribir 0 el valor controlado volvía a '' y parecía que no aceptaba el cero.
 */
export function scoreSideNumericInputHandlers(
  value: number,
  onNumericChange: (next: number) => void,
  options?: { max?: number },
): {
  placeholder: string
  value: number
  onChange: ChangeEventHandler<HTMLInputElement>
} {
  const cap = options?.max
  const v = Number.isFinite(value) ? Math.max(0, value) : 0
  return {
    placeholder: '0',
    value: v,
    onChange: (event) => {
      const raw = event.target.value
      let n = raw === '' ? 0 : Math.max(0, Number(raw) || 0)
      if (cap != null) n = Math.min(cap, n)
      onNumericChange(n)
    },
  }
}
