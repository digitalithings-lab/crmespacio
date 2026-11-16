import { Injectable } from '@angular/core';

// Guarda y valida la sesión (token JWT que entrega el backend al iniciar sesión).
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly clave = 'token'

  get token(): string | null {
    try { return localStorage.getItem(this.clave) } catch { return null }
  }

  guardar(token: string) {
    try { localStorage.setItem(this.clave, token) } catch { /* sin almacenamiento */ }
  }

  // ¿Hay un token y todavía no venció? (la validación real la hace siempre el backend)
  get sesionValida(): boolean {
    const t = this.token
    if (!t) return false
    try {
      const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
    } catch {
      return false
    }
  }

  cerrar() {
    try { ['token', 'nombre', 'apellido', 'correo'].forEach(k => localStorage.removeItem(k)) } catch { /* nada */ }
  }
}
