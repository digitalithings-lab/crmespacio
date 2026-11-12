import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
const api = environment.apiUrl

export interface Cliente {
  id: number
  idexpediente: number
  nombre: string
  apellido: string
  correo: string
  cedula: string
  telefono: string
  edad: number
  tipo: string
}

export interface Nota {
  idnota: number
  idexpediente: number
  texto: string
  fecha_creacion: string
  cliente_nombre?: string
  cliente_apellido?: string
}

export interface Archivo {
  idexpediente: number
  documento: string
  fecha_insercion: string
  url: string | null
  tamano: number | null
  cliente_nombre?: string
  cliente_apellido?: string
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
  readonly clienteContexto = new BehaviorSubject<number | null>(null)

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
  obtenerCliente(idexpediente: number): Observable<any> {
    return this.http.get<any>(`${api}/cliente/${idexpediente}`)
  }

  // ---- Notas ----
  crearNota(data: any): Observable<any> {
    return this.http.post<any>(`${api}/crearnota`, data).pipe(
      tap(() => this._notasActualizadas.next())
    )
  }
  listarNotas(idexpediente?: number): Observable<any> {
    return this.http.get<any>(idexpediente ? `${api}/notas/${idexpediente}` : `${api}/notas`)
  }

  // ---- Archivos (bucket) ----
  subirArchivo(idexpediente: number, archivo: File): Observable<any> {
    const form = new FormData()
    form.append('archivo', archivo)
    return this.http.post<any>(`${api}/subirarchivo/${idexpediente}`, form)
  }
  listarArchivos(idexpediente?: number): Observable<any> {
    return this.http.get<any>(idexpediente ? `${api}/archivos/${idexpediente}` : `${api}/archivos`)
  }
}
