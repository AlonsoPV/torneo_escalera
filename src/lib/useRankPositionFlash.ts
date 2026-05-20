import { useEffect, useRef, useState } from 'react'

/** Pulso breve cuando cambia la posición en ranking / standings (evita animaciones permanentes). */
export function useRankPositionFlashKeys(rows: { key: string; position: number }[], pulseMs = 550): Set<string> {
  const [flash, setFlash] = useState<Set<string>>(new Set())
  const prev = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const next = new Set<string>()
    for (const { key, position } of rows) {
      const old = prev.current.get(key)
      if (old !== undefined && old !== position) next.add(key)
      prev.current.set(key, position)
    }
    if (next.size === 0) return
    setFlash(next)
    const t = window.setTimeout(() => setFlash(new Set()), pulseMs)
    return () => clearTimeout(t)
  }, [rows, pulseMs])

  return flash
}
