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
  idexpediente: string
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

  abrirNota() { this._abrirNota.next() }

  // ---- Dashboard ----
  obtenerResumen(): Observable<any> {
    return this.http.get<any>(`${api}/resumen`)
  }

  // ---- Clientes ----
  crearCliente(data: any): Observable<any> {
    return this.http.post<any>(`${api}/crearcliente`, data)
  }
  listarClientes(): Observable<any> {
    return this.http.get<any>(`${api}/listarclientes`)
  }
  obtenerCliente(idexpediente: string): Observable<any> {
    return this.http.get<any>(`${api}/cliente/${idexpediente}`)
  }

  // ---- Billetera ----
  obtenerBilletera(idexpediente: string): Observable<any> {
    return this.http.get<any>(`${api}/billetera/${idexpediente}`)
  }
  crearCobro(data: any): Observable<any> {
    return this.http.post<any>(`${api}/cobros`, data)
  }
  pagarCobro(id: number, data: { metodo?: string; referencia?: string }): Observable<any> {
    return this.http.post<any>(`${api}/cobros/${id}/pagar`, data)
  }
  reenviarFactura(id: number): Observable<any> {
    return this.http.post<any>(`${api}/cobros/${id}/factura`, {})
  }
  recordarCobro(id: number): Observable<any> {
    return this.http.post<any>(`${api}/cobros/${id}/recordatorio`, {})
  }
  eliminarCobro(id: number): Observable<any> {
    return this.http.delete<any>(`${api}/cobros/${id}`)
  }

  // ---- Notas ----
  crearNota(data: any): Observable<any> {
    return this.http.post<any>(`${api}/crearnota`, data).pipe(
      tap(() => this._notasActualizadas.next())
    )
  }
  listarNotas(idexpediente?: string): Observable<any> {
    return this.http.get<any>(idexpediente ? `${api}/notas/${idexpediente}` : `${api}/notas`)
  }

  // ---- Archivos (bucket) ----
  subirArchivo(idexpediente: string, archivo: File): Observable<any> {
    const form = new FormData()
    form.append('archivo', archivo)
    return this.http.post<any>(`${api}/subirarchivo/${idexpediente}`, form)
  }
  listarArchivos(idexpediente?: string): Observable<any> {
    return this.http.get<any>(idexpediente ? `${api}/archivos/${idexpediente}` : `${api}/archivos`)
  }
}
