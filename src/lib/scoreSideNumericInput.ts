import type { ChangeEventHandler } from 'react'

/** Muestra 0 como campo vacío con placeholder; el primer dígito sustituye sin borrar. */
export function scoreSideNumericInputHandlers(
  value: number,
  onNumericChange: (next: number) => void,
  options?: { max?: number },
): {
  placeholder: string
  value: '' | number
  onChange: ChangeEventHandler<HTMLInputElement>
} {
  const cap = options?.max
  return {
    placeholder: '0',
    value: value === 0 ? '' : value,
    onChange: (event) => {
      const raw = event.target.value
      let n = raw === '' ? 0 : Math.max(0, Number(raw) || 0)
      if (cap != null) n = Math.min(cap, n)
      onNumericChange(n)
    },
  }
}
