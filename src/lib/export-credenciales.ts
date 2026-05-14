import * as XLSX from 'xlsx'

export interface CredencialRow {
  nombre: string
  apellido: string
  correo: string
  contrasena_temporal: string
  rol: string
  categoria: string
  grupo: string
  celular?: string
}

export function downloadCredencialesExcel(usuarios: CredencialRow[]) {
  const rows = usuarios.map((u) => ({
    Nombre: `${u.nombre} ${u.apellido}`.trim(),
    'Correo / usuario': u.correo,
    'Contraseña temporal': u.contrasena_temporal,
    Rol: u.rol,
    Categoría: u.categoria ?? '—',
    Grupo: u.grupo ?? '—',
    Celular: u.celular ?? '—',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  ws['!cols'] = [
    { wch: 28 },
    { wch: 30 },
    { wch: 20 },
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
    { wch: 15 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Credenciales')

  const fecha = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `credenciales-${fecha}.xlsx`)
}
