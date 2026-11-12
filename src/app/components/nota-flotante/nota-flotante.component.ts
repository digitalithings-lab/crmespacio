import { Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Cliente, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-nota-flotante',
  templateUrl: './nota-flotante.component.html',
  styleUrls: ['./nota-flotante.component.css']
})
export class NotaFlotanteComponent implements OnInit, OnDestroy {
  // Clases de posición del botón (cambia según la pantalla donde se use)
  @Input() posicion = 'bottom-6 right-6'

  public abierto = false
  public guardando = false
  public cargandoClientes = false
  public clientes: Cliente[] = []

  public idexpediente: number | null = null
  public texto = ''

  private contexto: number | null = null
  private subs: Subscription[] = []

  constructor(private service: ServiceclientesService, private toast: ToastService) { }

  ngOnInit(): void {
    this.subs.push(
      this.service.abrirNota$.subscribe(() => this.abrir()),
      this.service.clienteContexto.subscribe(id => (this.contexto = id))
    )
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe())
  }

  abrir() {
    this.abierto = true
    // Si estás dentro de un expediente, ese cliente queda preseleccionado
    if (this.contexto) this.idexpediente = this.contexto
    this.cargandoClientes = true
    this.service.listarClientes().subscribe({
      next: (resp) => { this.clientes = resp.data ?? []; this.cargandoClientes = false },
      error: () => { this.cargandoClientes = false }
    })
  }

  @HostListener('document:keydown.escape')
  cerrar() { if (!this.guardando) this.abierto = false }

  guardar() {
    if (this.guardando) return
    this.guardando = true
    this.service.crearNota({
      idexpediente: this.idexpediente,
      texto: this.texto.trim()
    }).subscribe({
      next: (resp) => {
        this.guardando = false
        if (resp.ok === true) {
          this.toast.success('Nota guardada')
          this.texto = ''
          this.abierto = false
        }
      },
      error: (err) => {
        this.guardando = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo guardar la nota')
      }
    })
  }
}
