import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { OpcionCliente, opcionesCliente } from 'src/app/utils/tipos';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit, OnDestroy {
  public nombre = localStorage.getItem('nombre')
  public apellido = localStorage.getItem('apellido')
  public correo = localStorage.getItem('correo')
 
  // Búsqueda rápida de clientes en la barra superior
  public busqueda = ''
  public buscando = false
  private opciones: OpcionCliente[] | null = null
  private sub?: Subscription

  constructor(private router: Router, private auth: AuthService, private clientes: ServiceclientesService) {}

  alEnfocarBusqueda() {
    this.buscando = true
    if (this.opciones === null) {
      this.opciones = []
      this.clientes.listarClientes().subscribe({ next: (r) => (this.opciones = opcionesCliente(r.data ?? [])), error: () => (this.opciones = null) })
    }
  }

  get resultados(): OpcionCliente[] {
    const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const q = norm(this.busqueda.trim())
    const todas = this.opciones ?? []
    return (q ? todas.filter(o => norm(o.etiqueta).includes(q)) : todas).slice(0, 8)
  }

  irACliente(o: OpcionCliente) {
    this.busqueda = ''
    this.buscando = false
    this.router.navigate(['/clientes', o.valor])
  }

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
