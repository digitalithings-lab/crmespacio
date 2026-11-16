import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit, OnDestroy {
  public nombre = localStorage.getItem('nombre')
  public apellido = localStorage.getItem('apellido')
  public correo = localStorage.getItem('correo')
 
  private sub?: Subscription

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit(): void {
    // En el teléfono el menú se cierra solo al llegar a otra página
    this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.cerrarMenu())
  }

  ngOnDestroy(): void { this.sub?.unsubscribe() }

  // El menú móvil es un checkbox (sin JS): desmarcarlo lo cierra
  cerrarMenu() {
    const caja = document.getElementById('menu-toggle') as HTMLInputElement | null
    if (caja) caja.checked = false
  }

  cerrarSesion() {
    this.auth.cerrar()
  }
}
