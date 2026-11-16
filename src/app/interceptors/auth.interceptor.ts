import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { ToastService } from 'src/app/services/toast.service';
import { environment } from 'src/environments/environment';

// Agrega el token a cada llamada al API y, si el servidor dice que la sesión no vale, cierra sesión.
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService, private router: Router, private toast: ToastService) { }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const esApi = req.url.startsWith(environment.apiUrl)
    const token = this.auth.token
    const peticion = esApi && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req

    return next.handle(peticion).pipe(
      catchError((err: HttpErrorResponse) => {
        // 401 en una ruta privada = sesión vencida o inválida (el login responde 401 por contraseña mala: no cuenta)
        if (err.status === 401 && esApi && !req.url.endsWith('/login') && token) {
          this.auth.cerrar()
          this.toast.error('Tu sesión venció. Inicia sesión de nuevo.')
          this.router.navigate(['/login'])
        }
        return throwError(() => err)
      })
    )
  }
}
