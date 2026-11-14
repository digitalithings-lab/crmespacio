import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
const api = environment.apiUrl

export interface Cliente {
  id: number
  idexpediente: string
  nombre: string
  apellido: string
  correo: string
  cedula: string
  telefono: string
  edad: number
  tipo: string
  // Pareja: las dos personas comparten idgrupo; integrantes trae a ambas (la primera es la principal)
  idgrupo?: string | null
  integrantes?: Cliente[]
  // Los calcula el servidor: nuevo / activo / inactivo, con lo que se usó para decidirlo
  estado?: 'nuevo' | 'activo' | 'inactivo'
  notas_total?: number
  citas_total?: number
  ultima_actividad?: string | null
}

export interface Nota {
  idnota: number
  idexpediente: string
  texto: string
  fecha_creacion: string
  cliente_nombre?: string
  cliente_apellido?: string
  // Nombre de la pareja («Mónica y Alejandro») cuando el cliente pertenece a un grupo
  cliente_grupo?: string | null
}

export interface Archivo {
  // null en los archivos propios (los que no pertenecen a ningún cliente)
  idexpediente: string | null
  propio?: boolean
  documento: string
  fecha_insercion: string
  url: string | null
  tamano: number | null
  cliente_nombre?: string
  cliente_apellido?: string
  // Nombre de la pareja («Mónica y Alejandro») cuando el cliente pertenece a un grupo
  cliente_grupo?: string | null
}

export interface Cobro {
  id: number
  idexpediente: string
  concepto: string
  monto: string | number
  moneda: string
  origen: string
  codigo_sala: string | null
  fecha_servicio: string | null
  estado: 'pendiente' | 'pagado'
  fecha_pago: string | null
  metodo: string | null
  referencia: string | null
  factura_numero: string | null
  comprobante: string | null
  factura_enviada: string | null
  recordatorio_enviado: string | null
  recordatorios: number
  fecha_creacion: string
}

export interface ReunionSinCobro { codigo: string; nombre: string | null; fecha_creacion: string }

export interface Billetera {
  cobros: Cobro[]
  reunionesSinCobro: ReunionSinCobro[]
  resumen: { pagado: number; pendiente: number; moneda: string | null }
}

export interface CitaAgenda {
  id: string
  startsAt: string
  endsAt: string
  status: 'REQUESTED' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'
  modality: string
  meetingUrl: string | null
  note: string | null
  clientType: string
  crmGroupId?: string | null
  priceCents: number
  currency: string
  paid: boolean
  cancelReason?: string | null
  patient: { fullName: string | null; idNumber: string | null; age: number | null; email: string | null; phone: string | null }
  partner: { fullName: string | null; idNumber: string | null; age?: number | null; email: string | null; phone: string | null } | null
  cliente1: Cliente | null
  cliente2: Cliente | null
  clientes: Cliente[]
  cobro: Cobro | null
}

// ---- Formularios por cliente ----
export type TipoCampo = 'texto' | 'parrafo' | 'numero' | 'fecha' | 'correo' | 'telefono' | 'opcion' | 'casillas' | 'sino' | 'archivo'
export interface CampoForm { id?: string; tipo: TipoCampo; etiqueta: string; requerido: boolean; opciones?: string[]; ayuda?: string; max?: number }
export interface Formulario {
  id: string; idexpediente: string; titulo: string; descripcion: string | null; campos: CampoForm[]
  estado: 'borrador' | 'abierto' | 'enviado' | 'cerrado' | 'vencido'
  expira_en: string | null; respondido_en: string | null; fecha_creacion: string; url: string | null; archivos: number
  // Persona a quien pertenece (en una pareja, cada una tiene su propio formulario)
  cliente_nombre?: string; cliente_apellido?: string; cliente_telefono?: string
  // Lo que respondió (solo si se pidió con respuestas=true y el formulario ya fue respondido)
  respuestas?: { etiqueta: string; tipo: string; valor: any; archivos: { documento: string; url: string | null }[] }[]
}

export interface Plantilla { id: string; titulo: string; descripcion: string | null; campos: CampoForm[]; fecha_creacion: string; actualizada: string }
export type FormularioGlobal = Formulario

@Injectable({
  providedIn: 'root'
})
export class ServiceclientesService {

  // Avisa a las vistas abiertas que deben recargar sus datos
  private _notasActualizadas = new Subject<void>()
  readonly notasActualizadas$ = this._notasActualizadas.asObservable()

  // Pide abrir la nota flotante (desde cualquier botón de la app)
  private _abrirNota = new Subject<void>()
  readonly abrirNota$ = this._abrirNota.asObservable()

  // Cliente al que pertenece la vista actual (el expediente abierto), para preseleccionarlo
  readonly clienteContexto = new BehaviorSubject<string | null>(null)

  constructor(private http: HttpClient) { }

  // ---- Caché "mostrar ya, actualizar después" ----
  // Las listas se pintan al instante con lo último que se vio y se refrescan en segundo plano.
  // Si el dato es muy reciente (menos de `ttlMs`) ni siquiera se vuelve a pedir. Cualquier cambio (crear, editar…) la vacía.
  private cache = new Map<string, { t: number; v: any }>()

  private swr<T>(clave: string, ttlMs: number, peticion: () => Observable<T>): Observable<T> {
    return new Observable<T>(sub => {
      const c = this.cache.get(clave)
      if (c) sub.next(c.v)
      if (c && Date.now() - c.t < ttlMs) { sub.complete(); return }
      const s = peticion().subscribe({
        next: v => { this.cache.set(clave, { t: Date.now(), v }); sub.next(v) },
        error: e => { if (c) sub.complete(); else sub.error(e) },
        complete: () => sub.complete()
      })
      return () => s.unsubscribe()
    })
  }

  private cambio = <T>() => tap<T>(() => this.cache.clear())

  abrirNota() { this._abrirNota.next() }

  // ---- Dashboard ----
  obtenerResumen(): Observable<any> {
    return this.swr('resumen', 20_000, () => this.http.get<any>(`${api}/resumen`))
  }

  // ---- Clientes ----
  crearCliente(data: any): Observable<any> {
    return this.http.post<any>(`${api}/crearcliente`, data).pipe(this.cambio())
  }
  listarClientes(): Observable<any> {
    return this.swr('clientes', 20_000, () => this.http.get<any>(`${api}/listarclientes`))
  }
  obtenerCliente(idexpediente: string): Observable<any> {
    return this.http.get<any>(`${api}/cliente/${idexpediente}`)
  }

  // ---- Agenda (citas de Florece) ----
  obtenerAgenda(desde: Date, hasta: Date): Observable<any> {
    return this.http.get<any>(`${api}/agenda`, { params: { desde: desde.toISOString(), hasta: hasta.toISOString() } })
  }

  registrarCita(data: any): Observable<any> {
    return this.http.post<any>(`${api}/agenda/registrar`, data).pipe(this.cambio())
  }
  editarCliente(idexpediente: string, data: any): Observable<any> {
    return this.http.patch<any>(`${api}/cliente/${idexpediente}`, data).pipe(this.cambio())
  }

  // ---- Citas (confirmar, cancelar…) y ajustes de la agenda ----
  actuarCita(id: string, data: any): Observable<any> {
    return this.http.patch<any>(`${api}/agenda/citas/${id}`, data).pipe(this.cambio())
  }
  crearCita(data: any): Observable<any> {
    return this.http.post<any>(`${api}/agenda/citas`, data).pipe(this.cambio())
  }
  horariosLibres(desde: string, dias = 1): Observable<any> {
    return this.http.get<any>(`${api}/agenda/horarios-libres`, { params: { desde, dias } })
  }
  obtenerAjustes(): Observable<any> {
    return this.http.get<any>(`${api}/agenda/ajustes`)
  }
  guardarConfigAgenda(data: any): Observable<any> {
    return this.http.put<any>(`${api}/agenda/ajustes/config`, data)
  }
  guardarHorarios(reglas: any[]): Observable<any> {
    return this.http.put<any>(`${api}/agenda/ajustes/horarios`, { reglas })
  }
  crearBloqueo(data: any): Observable<any> {
    return this.http.post<any>(`${api}/agenda/ajustes/bloqueos`, data)
  }
  quitarBloqueo(id: string | number): Observable<any> {
    return this.http.delete<any>(`${api}/agenda/ajustes/bloqueos/${id}`)
  }

  // ---- Formularios ----
  crearFormulario(data: any): Observable<any> { return this.http.post<any>(`${api}/formularios`, data) }
  listarFormularios(idexpediente: string, conRespuestas = false): Observable<any> {
    return this.http.get<any>(`${api}/formularios/${idexpediente}`, conRespuestas ? { params: { respuestas: '1' } } : {})
  }
  generarUrlFormulario(id: string, dias: number): Observable<any> { return this.http.post<any>(`${api}/formularios/${id}/url`, { dias }) }
  cerrarFormulario(id: string): Observable<any> { return this.http.post<any>(`${api}/formularios/${id}/cerrar`, {}) }
  duplicarFormulario(id: string): Observable<any> { return this.http.post<any>(`${api}/formularios/${id}/duplicar`, {}) }
  eliminarFormulario(id: string): Observable<any> { return this.http.delete<any>(`${api}/formularios/${id}`) }
  respuestasFormulario(id: string): Observable<any> { return this.http.get<any>(`${api}/formularios/${id}/respuestas`) }
  // Plantillas generales (se asignan a cada cliente) y seguimiento
  listarFormulariosGlobal(): Observable<any> { return this.http.get<any>(`${api}/formularios`) }
  listarPlantillas(): Observable<any> { return this.http.get<any>(`${api}/plantillas`) }
  crearPlantilla(data: any): Observable<any> { return this.http.post<any>(`${api}/plantillas`, data) }
  editarPlantilla(id: string, data: any): Observable<any> { return this.http.put<any>(`${api}/plantillas/${id}`, data) }
  eliminarPlantilla(id: string): Observable<any> { return this.http.delete<any>(`${api}/plantillas/${id}`) }
  asignarPlantilla(id: string, data: { idexpediente: string; generarUrl?: boolean; dias?: number }): Observable<any> {
    return this.http.post<any>(`${api}/plantillas/${id}/asignar`, data)
  }
  formularioAPlantilla(id: string): Observable<any> { return this.http.post<any>(`${api}/formularios/${id}/plantilla`, {}) }
  // Página pública
  verFormularioPublico(token: string): Observable<any> { return this.http.get<any>(`${api}/f/${token}`) }
  subirArchivoFormulario(token: string, campo: string, file: File): Observable<any> {
    const form = new FormData()
    form.append('campo', campo)
    form.append('archivo', file)
    return this.http.post<any>(`${api}/f/${token}/archivo`, form)
  }
  enviarFormulario(token: string, respuestas: any): Observable<any> { return this.http.post<any>(`${api}/f/${token}`, { respuestas, website: '' }) }

  // ---- Billetera ----
  obtenerBilletera(idexpediente: string): Observable<any> {
    return this.http.get<any>(`${api}/billetera/${idexpediente}`)
  }
  crearCobro(data: any): Observable<any> {
    return this.http.post<any>(`${api}/cobros`, data).pipe(this.cambio())
  }
  pagarCobro(id: number, data: { metodo?: string; referencia?: string }): Observable<any> {
    return this.http.post<any>(`${api}/cobros/${id}/pagar`, data).pipe(this.cambio())
  }
  reenviarFactura(id: number): Observable<any> {
    return this.http.post<any>(`${api}/cobros/${id}/factura`, {})
  }
  recordarCobro(id: number): Observable<any> {
    return this.http.post<any>(`${api}/cobros/${id}/recordatorio`, {})
  }
  subirComprobante(id: number, file: File): Observable<any> {
    const form = new FormData()
    form.append('archivo', file)
    return this.http.post<any>(`${api}/cobros/${id}/comprobante`, form)
  }
  eliminarCobro(id: number): Observable<any> {
    return this.http.delete<any>(`${api}/cobros/${id}`)
  }

  // ---- Notas ----
  crearNota(data: any): Observable<any> {
    return this.http.post<any>(`${api}/crearnota`, data).pipe(
      tap(() => { this.cache.clear(); this._notasActualizadas.next() })
    )
  }
  listarNotas(idexpediente?: string): Observable<any> {
    return this.http.get<any>(idexpediente ? `${api}/notas/${idexpediente}` : `${api}/notas`)
  }

  // ---- Archivos (bucket) ----
  subirArchivo(idexpediente: string, archivo: File): Observable<any> {
    const form = new FormData()
    form.append('archivo', archivo)
    return this.http.post<any>(`${api}/subirarchivo/${idexpediente}`, form).pipe(this.cambio())
  }
  // Archivo propio de la biblioteca: no está unido a ningún cliente
  subirArchivoPropio(archivo: File): Observable<any> {
    const form = new FormData()
    form.append('archivo', archivo)
    return this.http.post<any>(`${api}/subirpropio`, form).pipe(this.cambio())
  }
  listarArchivos(idexpediente?: string): Observable<any> {
    return this.http.get<any>(idexpediente ? `${api}/archivos/${idexpediente}` : `${api}/archivos`)
  }
}
