import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { iconoArchivo } from 'src/app/utils/archivos';
import { nombreGrupo, TIPOS } from 'src/app/utils/tipos';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  public nombre = localStorage.getItem('nombre')
  public apellido = localStorage.getItem('apellido')
  public correo = localStorage.getItem('correo')

  public cargando = true
  public error = false
  public totales = { clientes: 0, notas: 0, notasSemana: 0, archivos: 0 }
  public porTipo: { tipo: string, total: number }[] = []
  public clientesRecientes: any[] = []
  public notasRecientes: any[] = []
  public archivosRecientes: any[] = []

  public tipos = TIPOS
  private sub?: Subscription

  constructor(private service: ServiceclientesService, private toast: ToastService) { }

  ngOnInit(): void {
    this.datos()
    // Si guardas una nota desde el botón flotante, el resumen se actualiza solo
    this.sub = this.service.notasActualizadas$.subscribe(() => this.datos(false))
  }

  ngOnDestroy(): void { this.sub?.unsubscribe() }

  datos(mostrarSkeleton = true) {
    if (mostrarSkeleton) this.cargando = true
    this.service.obtenerResumen().subscribe({
      next: (resp) => {
        const d = resp.data
        this.totales = d.totales
        this.porTipo = d.porTipo
        this.clientesRecientes = d.clientesRecientes
        this.notasRecientes = d.notasRecientes
        this.archivosRecientes = d.archivosRecientes
        this.error = false
        this.cargando = false
      },
      error: () => {
        this.cargando = false
        this.error = true
        this.toast.error('No se pudo cargar el resumen')
      }
    })
  }

  // Cantidad de clientes de un tipo (0 si no hay ninguno)
  cantidad(tipo: string) {
    return this.porTipo.find(t => t.tipo === tipo)?.total ?? 0
  }

  porcentaje(tipo: string) {
    return this.totales.clientes ? Math.round((this.cantidad(tipo) / this.totales.clientes) * 100) : 0
  }

  nombreFila(c: any) { return nombreGrupo(c.integrantes?.length ? c.integrantes : [c]) }

  iniciales(c: any) {
    return `${c.nombre?.[0] ?? ''}${c.apellido?.[0] ?? ''}`.toUpperCase()
  }

  icono(nombre: string) { return iconoArchivo(nombre) }
}
