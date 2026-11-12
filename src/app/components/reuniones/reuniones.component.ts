import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Cliente, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { ServicesalaService } from 'src/app/services/servicesala.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-reuniones',
  templateUrl: './reuniones.component.html',
  styleUrls: ['./reuniones.component.css']
})
export class ReunionesComponent implements OnInit {
  public clientes: Cliente[] = []
  public idexpediente: number | null = null
  public nombre = ''
  public creando = false
  public codigo = ''
  public copiado = false

  public codigoUnirse = ''

  public salas: any[] = []
  public cargandoSalas = true

  constructor(
    private service: ServicesalaService,
    private clientesService: ServiceclientesService,
    private toast: ToastService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.clientesService.listarClientes().subscribe({ next: (resp) => (this.clientes = resp.data ?? []) })
    this.cargarSalas()
  }

  cargarSalas() {
    this.service.listarSalas().subscribe({
      next: (resp) => { this.salas = resp.data ?? []; this.cargandoSalas = false },
      error: () => { this.cargandoSalas = false }
    })
  }

  enlaceDe(codigo: string) {
    return `${window.location.origin}/sala/${codigo}`
  }

  get enlace() {
    return this.codigo ? this.enlaceDe(this.codigo) : ''
  }

  crear() {
    if (this.creando) return
    if (!this.idexpediente) { this.toast.info('Elige el cliente de la reunión'); return }
    this.creando = true
    this.service.crearSala(this.idexpediente, this.nombre.trim()).subscribe({
      next: (resp) => {
        this.creando = false
        this.codigo = resp.data.codigo
        this.copiado = false
        this.cargarSalas()
      },
      error: (err) => {
        this.creando = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo crear la reunión')
      }
    })
  }

  nueva() {
    this.codigo = ''
    this.nombre = ''
    this.idexpediente = null
  }

  async copiar(codigo = this.codigo, esActual = true) {
    try {
      await navigator.clipboard.writeText(this.enlaceDe(codigo))
      if (esActual) { this.copiado = true; setTimeout(() => (this.copiado = false), 2500) }
      this.toast.success('Enlace copiado')
    } catch {
      this.toast.error('No se pudo copiar. Selecciona el enlace y cópialo a mano.')
    }
  }

  entrar(codigo = this.codigo) {
    this.router.navigate(['/sala', codigo])
  }

  unirse() {
    // Acepta el código solo o el enlace completo
    const codigo = this.codigoUnirse.trim().split('/').filter(Boolean).pop()?.toLowerCase()
    if (!codigo) return
    this.router.navigate(['/sala', codigo])
  }
}
