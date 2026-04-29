import type { ReactNode } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type AdminDataTableColumn<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

export function AdminDataTable<T>({
  rows,
  columns,
  getRowKey,
}: {
  rows: T[]
  columns: AdminDataTableColumn<T>[]
  getRowKey: (row: T) => string
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
      <Table className="min-w-[38rem] sm:min-w-[42rem]">
        <TableHeader>
          <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowKey(row)}>
              {columns.map((column) => (
                <TableCell key={column.key} className={column.className}>
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
