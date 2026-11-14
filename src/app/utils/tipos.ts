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

// ---- Selección de clientes: una pareja es UNA sola opción ----
export interface ClienteBase {
  id: number
  idexpediente: string
  nombre: string
  apellido: string
  tipo: string
  idgrupo?: string | null
}

export interface OpcionCliente {
  valor: string // idexpediente de la persona principal (la primera registrada)
  etiqueta: string
}

function grupos(clientes: ClienteBase[]): ClienteBase[][] {
  const lista: ClienteBase[][] = []
  const porGrupo = new Map<string, ClienteBase[]>()
  for (const c of clientes) {
    if (c.idgrupo) {
      const g = porGrupo.get(c.idgrupo)
      if (g) { g.push(c); continue }
      const nuevo = [c]
      porGrupo.set(c.idgrupo, nuevo)
      lista.push(nuevo)
    } else {
      lista.push([c])
    }
  }
  lista.forEach(g => g.sort((a, b) => Number(a.id) - Number(b.id)))
  return lista
}

/** Opciones para un selector: «Mónica y Alejandro (pareja)» o «Ana Pérez (individual)». */
export function opcionesCliente(clientes: ClienteBase[]): OpcionCliente[] {
  return grupos(clientes).map(g => ({
    valor: g[0].idexpediente,
    etiqueta: g.length > 1
      ? `${nombreGrupo(g)} (pareja)`
      : `${g[0].nombre} ${g[0].apellido} (${etiquetaTipo(g[0].tipo).toLowerCase()})`
  }))
}

/** Si el expediente es de una persona de una pareja, devuelve el de la persona principal del grupo. */
export function principalDe(idexpediente: string | null, clientes: ClienteBase[]): string | null {
  if (!idexpediente) return null
  const g = grupos(clientes).find(grupo => grupo.some(c => c.idexpediente === idexpediente))
  return g ? g[0].idexpediente : idexpediente
}

// ---- Estado del cliente (lo calcula el servidor) ----
export const ESTADOS = [
  { valor: 'nuevo', etiqueta: 'Nuevo' },
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'inactivo', etiqueta: 'Inactivo' },
]

export function etiquetaEstado(valor?: string | null): string {
  return ESTADOS.find(e => e.valor === valor)?.etiqueta ?? ''
}

export function claseEstado(valor?: string | null): string {
  if (valor === 'activo') return 'bg-emerald-100 text-emerald-800'
  if (valor === 'nuevo') return 'bg-sky-100 text-sky-800'
  if (valor === 'inactivo') return 'bg-zinc-200 text-zinc-600'
  return 'bg-zinc-100 text-zinc-500'
}

/** Explica por qué el cliente tiene ese estado. */
export function detalleEstado(c: { estado?: string; notas_total?: number; citas_total?: number; ultima_actividad?: string | null }): string {
  const partes = [`${c.notas_total ?? 0} notas`, `${c.citas_total ?? 0} citas`]
  if (c.ultima_actividad) partes.push(`última actividad ${new Date(c.ultima_actividad).toLocaleDateString('es')}`)
  return partes.join(' · ')
}
