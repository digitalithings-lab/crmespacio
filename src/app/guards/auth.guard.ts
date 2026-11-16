import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

// Las páginas del panel solo se abren con una sesión vigente; si no, al login.
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService)
  if (auth.sesionValida) return true
  auth.cerrar()
  return inject(Router).parseUrl('/login')
};
