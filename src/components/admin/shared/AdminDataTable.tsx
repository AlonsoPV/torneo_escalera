import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type AdminDataTableColumn<T> = {
  key: string
  header: string
  /** Texto nativo al pasar el ratón (aclaración del significado de la columna). */
  headerTitle?: string
  render: (row: T) => ReactNode
  className?: string
  sortable?: boolean
}

export type AdminDataTableSort = {
  key: string
  direction: 'asc' | 'desc'
}

/** Clase compartida para checkboxes de selección de filas (p. ej. vista móvil). */
export const ADMIN_TABLE_ROW_CHECKBOX_CLASS =
  'size-4 shrink-0 rounded border-slate-300 text-[#1F5A4C] focus:ring-[#1F5A4C] disabled:opacity-50'

export type AdminDataTableRowSelection = {
  selectedKeys: ReadonlySet<string>
  onToggleRow: (key: string, selected: boolean) => void
  /** Selecciona o quita la selección de todas las filas actualmente en `rows`. */
  onToggleAllVisible: (select: boolean) => void
}

export function AdminDataTable<T>({
  rows,
  columns,
  getRowKey,
  getRowDomId,
  getRowClassName,
  tableId,
  footer,
  rowSelection,
  sort,
  onSortChange,
}: {
  rows: T[]
  columns: AdminDataTableColumn<T>[]
  getRowKey: (row: T) => string
  /** Atributo `id` en cada `<tr>` (p. ej. pruebas E2E). */
  getRowDomId?: (row: T) => string
  /** Clases extra por fila (p. ej. resaltar fila enlazada desde notificaciones). */
  getRowClassName?: (row: T) => string | undefined
  /** Atributo `id` en el contenedor de la tabla. */
  tableId?: string
  /** Contenido opcional en `<tfoot>` (p. ej. paginación “Ver más”). */
  footer?: ReactNode
  /** Columna inicial con checkboxes y selección de la página visible. */
  rowSelection?: AdminDataTableRowSelection
  sort?: AdminDataTableSort | null
  onSortChange?: (next: AdminDataTableSort) => void
}) {
  const visibleKeys = rows.map(getRowKey)
  const allVisibleSelected =
    visibleKeys.length > 0 && visibleKeys.every((k) => rowSelection?.selectedKeys.has(k))
  const someVisibleSelected =
    !!rowSelection &&
    visibleKeys.some((k) => rowSelection.selectedKeys.has(k)) &&
    !allVisibleSelected

  return (
    <div
      id={tableId}
      className="min-w-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
    >
      <Table className="min-w-[36rem] sm:min-w-[42rem]">
        <TableHeader>
          <TableRow className="border-b border-border/70 bg-muted/35 hover:bg-muted/35">
            {rowSelection ? (
              <TableHead className="w-10 px-2">
                <input
                  type="checkbox"
                  className={ADMIN_TABLE_ROW_CHECKBOX_CLASS}
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected
                  }}
                  onChange={() => rowSelection.onToggleAllVisible(!allVisibleSelected)}
                  aria-label="Seleccionar todas las filas visibles"
                />
              </TableHead>
            ) : null}
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className} title={column.headerTitle}>
                {column.sortable && onSortChange ? (
                  <button
                    type="button"
                    id={tableId ? `${tableId}-sort-${column.key}` : undefined}
                    data-name={`table-sort-${column.key}`}
                    onClick={() =>
                      onSortChange({
                        key: column.key,
                        direction:
                          sort?.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc',
                      })
                    }
                    className={cn(
                      '-mx-1 inline-flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-xs font-semibold uppercase tracking-wide',
                      'text-slate-700 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5A4C]/30',
                      sort?.key === column.key && 'text-[#1F5A4C]',
                    )}
                    aria-label={`Ordenar por ${column.header}`}
                  >
                    <span className="truncate">{column.header}</span>
                    {sort?.key === column.key ? (
                      sort.direction === 'asc' ? (
                        <ArrowUp className="size-3.5 shrink-0" aria-hidden />
                      ) : (
                        <ArrowDown className="size-3.5 shrink-0" aria-hidden />
                      )
                    ) : (
                      <ArrowUpDown className="size-3.5 shrink-0 opacity-45" aria-hidden />
                    )}
                  </button>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={getRowKey(row)}
              id={getRowDomId?.(row)}
              className={cn(getRowClassName?.(row))}
            >
              {rowSelection ? (
                <TableCell className="w-10 px-2">
                  <input
                    type="checkbox"
                    className={ADMIN_TABLE_ROW_CHECKBOX_CLASS}
                    checked={rowSelection.selectedKeys.has(getRowKey(row))}
                    onChange={(event) => rowSelection.onToggleRow(getRowKey(row), event.target.checked)}
                    aria-label="Seleccionar fila"
                  />
                </TableCell>
              ) : null}
              {columns.map((column) => (
                <TableCell key={column.key} className={column.className}>
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {footer ? <TableFooter>{footer}</TableFooter> : null}
      </Table>
    </div>
  )
}
