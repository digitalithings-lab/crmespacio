// Ayudas para mostrar archivos. La tabla solo guarda el nombre, así que el tipo se deduce de la extensión.

const extension = (nombre: string) => (nombre?.split('.').pop() ?? '').toLowerCase()

export function iconoArchivo(nombre: string): string {
  const e = extension(nombre)
  if (e === 'pdf') return 'file-pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(e)) return 'image'
  if (['doc', 'docx'].includes(e)) return 'file-doc'
  if (['xls', 'xlsx'].includes(e)) return 'file-xls'
  if (e === 'csv') return 'file-csv'
  if (['txt', 'md'].includes(e)) return 'file-text'
  return 'file'
}

export function categoriaArchivo(nombre: string): 'Documentos' | 'Imágenes' | 'Otros' {
  const i = iconoArchivo(nombre)
  if (i === 'image') return 'Imágenes'
  if (i === 'file') return 'Otros'
  return 'Documentos'
}

export function formatoTamano(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
