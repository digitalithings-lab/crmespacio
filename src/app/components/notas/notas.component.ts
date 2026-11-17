import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Cliente, Nota, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { opcionesCliente, principalDe } from 'src/app/utils/tipos';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-notas',
  templateUrl: './notas.component.html',
  styleUrls: ['./notas.component.css']
})
export class NotasComponent implements OnInit, OnDestroy {
  public notas: Nota[] = []
  public cargando = true
  public busqueda = ''
  public clientes: Cliente[] = []
  public clienteFiltro: string | null = null
  public verFiltro = false
  private sub?: Subscription

  constructor(private service: ServiceclientesService, private toast: ToastService) { }

  ngOnInit(): void {
    this.cargar()
    this.service.listarClientes().subscribe({ next: (r) => (this.clientes = r.data ?? []), error: () => { } })
    // Cuando guardas una nota desde el botón flotante, la lista se refresca sola
    this.sub = this.service.notasActualizadas$.subscribe(() => this.cargar(false))
  }

  ngOnDestroy(): void { this.sub?.unsubscribe() }

  cargar(mostrarSkeleton = true) {
    if (mostrarSkeleton) this.cargando = true
    this.service.listarNotas().subscribe({
      next: (resp) => { this.notas = resp.data ?? []; this.cargando = false },
      error: () => { this.cargando = false; this.toast.error('No se pudieron cargar las notas') }
    })
  }

  get opciones() { return opcionesCliente(this.clientes) }

  get clienteElegido() { return this.opciones.find(o => o.valor === this.clienteFiltro) }

  elegirCliente(id: string | null) {
    this.clienteFiltro = id
    if (id) this.verFiltro = false
  }

  get filtradas(): Nota[] {
    const q = this.busqueda.trim().toLowerCase()
    // Una pareja comparte notas: se filtra por el expediente principal del grupo
    const base = this.clienteFiltro
      ? this.notas.filter(n => principalDe(n.idexpediente, this.clientes) === this.clienteFiltro)
      : this.notas
    return !q ? base : base.filter(n =>
      `${n.texto} ${n.cliente_grupo ?? ''} ${n.cliente_nombre} ${n.cliente_apellido}`.toLowerCase().includes(q))
  }

  nueva() { this.service.abrirNota() }
}
