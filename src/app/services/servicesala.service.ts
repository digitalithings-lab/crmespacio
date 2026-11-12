import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
const api = environment.apiUrl

export type TipoSenal = 'join' | 'leave' | 'offer' | 'answer' | 'ice'

export interface Senal {
  id: number
  de: string
  para: string | null
  tipo: TipoSenal
  payload: any
}

@Injectable({
  providedIn: 'root'
})
export class ServicesalaService {

  constructor(private http: HttpClient) { }

  // Toda reunión pertenece a un cliente (idexpediente) y queda en su historial
  crearSala(idexpediente: number, nombre?: string): Observable<any> {
    return this.http.post<any>(`${api}/crearsala`, { idexpediente, nombre })
  }

  listarSalas(idexpediente?: number): Observable<any> {
    return this.http.get<any>(idexpediente ? `${api}/salas/${idexpediente}` : `${api}/salas`)
  }

  obtenerSala(codigo: string): Observable<any> {
    return this.http.get<any>(`${api}/sala/${codigo}`)
  }

  enviarSenal(codigo: string, senal: { de: string, para?: string, tipo: TipoSenal, payload?: any }): Observable<any> {
    return this.http.post<any>(`${api}/sala/${codigo}/senal`, senal)
  }

  leerSenales(codigo: string, peer: string, desde: number): Observable<any> {
    return this.http.get<any>(`${api}/sala/${codigo}/senales`, { params: { peer, desde } })
  }

  // Al cerrar la pestaña: fetch con keepalive para que la petición salga igual
  avisarSalida(codigo: string, de: string) {
    try {
      fetch(`${api}/sala/${codigo}/senal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ de, tipo: 'leave' }),
        keepalive: true
      })
    } catch { /* sin conexión: nada que hacer */ }
  }
}
