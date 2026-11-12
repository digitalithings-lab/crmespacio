// Valores del tipo de cliente tal como los guarda la base de datos (restricción clientes_tipo_check)
export const TIPOS = [
  { valor: 'pareja', etiqueta: 'Pareja' },
  { valor: 'individual', etiqueta: 'Individual' },
  { valor: 'niños/adolescentes', etiqueta: 'Niños/Adolescentes' },
]

export function etiquetaTipo(valor: string): string {
  return TIPOS.find(t => t.valor === (valor ?? '').toLowerCase())?.etiqueta ?? valor
}

export function claseTipo(valor: string): string {
  const v = (valor ?? '').toLowerCase()
  if (v === 'pareja') return 'bg-brand-50 text-brand-700'
  if (v === 'niños/adolescentes') return 'bg-amber-50 text-amber-800'
  return 'bg-zinc-100 text-zinc-700'
}

/** Nombre a mostrar de un cliente o de una pareja: «Carlos y Gene» (primer nombre de cada uno). */
export function nombreGrupo(integrantes: { nombre: string; apellido: string }[]): string {
  if (integrantes.length <= 1) return integrantes[0] ? `${integrantes[0].nombre} ${integrantes[0].apellido}` : ''
  return integrantes.map(p => p.nombre.split(' ')[0]).join(' y ')
}
