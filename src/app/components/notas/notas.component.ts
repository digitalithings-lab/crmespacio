import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Nota, ServiceclientesService } from 'src/app/services/serviceclientes.service';
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
  private sub?: Subscription

  constructor(private service: ServiceclientesService, private toast: ToastService) { }

  ngOnInit(): void {
    this.cargar()
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

  get filtradas(): Nota[] {
    const q = this.busqueda.trim().toLowerCase()
    return !q ? this.notas : this.notas.filter(n =>
      `${n.texto} ${n.cliente_nombre} ${n.cliente_apellido}`.toLowerCase().includes(q))
  }

  nueva() { this.service.abrirNota() }
}
