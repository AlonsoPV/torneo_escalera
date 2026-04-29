import type { Tournament } from '@/types/database'

const MAX_TOURNAMENT_NAME_IN_URL = 120

/**
 * Un segmento de ruta con el **nombre legible** del torneo (mayúsculas, acentos, espacios)
 * codificado para URL. En la barra de direcciones el navegador suele mostrarlo sin `%20`.
 */
export function tournamentNamePathSegment(name: string | null | undefined): string {
  let raw = (name && name.trim()) || 'Torneo'
  raw = raw
    .replace(/[/\\]+/g, ' – ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_TOURNAMENT_NAME_IN_URL)
  if (!raw) raw = 'Torneo'
  return encodeURIComponent(raw)
}

/**
 * `location.pathname` a veces trae el segmento decodificado (`Mi Torneo`) y a veces
 * codificado (`Mi%20Torneo`); al comparar con `tournamentPath` hay que unificar.
 */
export function pathnamesTournamentEqual(a: string, b: string): boolean {
  const strip = (p: string) => p.split('?')[0].split('#')[0]
  const normalize = (p: string) => {
    const s = strip(p)
    const segs = s.split('/').filter((x) => x.length > 0)
    return (
      '/' +
      segs
        .map((seg) => {
          try {
            return decodeURIComponent(seg)
          } catch {
            return seg
          }
        })
        .join('/')
    )
  }
  return normalize(a) === normalize(b)
}

/** Ruta pública: `/tournaments/{id}/{nombre}`. */
export function tournamentPath(t: Pick<Tournament, 'id' | 'name'>): string {
  return `/tournaments/${t.id}/${tournamentNamePathSegment(t.name)}`
}

export function tournamentPathWithGroup(t: Pick<Tournament, 'id' | 'name'>, groupId: string): string {
  return `${tournamentPath(t)}?group=${encodeURIComponent(groupId)}`
}

/** Misma URL con `?group=` que `tournamentPathWithGroup` cuando solo tienes id y nombre. */
export function tournamentGroupPathFromIdAndName(
  id: string,
  name: string | null | undefined,
  groupId: string,
): string {
  return tournamentPathWithGroup({ id, name: (name && name.trim()) || 'torneo' }, groupId)
}

/** Cuando solo tienes id y nombre (p. ej. en tablas de partidos). */
export function tournamentPathFromIdAndName(
  id: string,
  name: string | null | undefined,
): string {
  return `/tournaments/${id}/${tournamentNamePathSegment(name || 'Torneo')}`
}
