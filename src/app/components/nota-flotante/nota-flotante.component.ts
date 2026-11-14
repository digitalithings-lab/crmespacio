import { Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Archivo, Cliente, Formulario, Nota, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { claseTipo, etiquetaTipo, opcionesCliente, principalDe } from 'src/app/utils/tipos';
import { formatoTamano, iconoArchivo } from 'src/app/utils/archivos';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-nota-flotante',
  templateUrl: './nota-flotante.component.html',
  styleUrls: ['./nota-flotante.component.css']
})
export class NotaFlotanteComponent implements OnInit, OnDestroy {
  // Clases de posición del botón (cambia según la pantalla donde se use)
  @Input() posicion = 'bottom-6 right-6'
  // En la videollamada se abre como panel lateral (sin tapar el video) y no se cierra al guardar
  @Input() lateral = false

  public pestana: 'nota' | 'notas' | 'expediente' | 'formularios' = 'nota'
  public notas: Nota[] = []
  public cargandoNotas = false
  public archivos: Archivo[] = []
  public personas: Cliente[] = []
  // Formularios del cliente, con lo que respondió (en una pareja, uno por persona)
  public formularios: Formulario[] = []
  public cargandoFormularios = false
  public cargandoExpediente = false

  public abierto = false
  public guardando = false
  public cargandoClientes = false
  public clientes: Cliente[] = []

  public idexpediente: string | null = null
  public texto = ''

  private contexto: string | null = null
  private subs: Subscription[] = []

  constructor(private service: ServiceclientesService, private toast: ToastService) { }

  ngOnInit(): void {
    this.subs.push(
      this.service.abrirNota$.subscribe(() => this.abrir()),
      this.service.clienteContexto.subscribe(id => (this.contexto = id)),
      // Cuando se guarda una nota (aquí o en otra parte), se actualiza la lista
      this.service.notasActualizadas$.subscribe(() => { if (this.abierto) this.cargarNotas() })
    )
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe())
  }

  get opciones() { return opcionesCliente(this.clientes) }

  abrir() {
    this.abierto = true
    this.pestana = 'nota'
    // Si estás dentro de un expediente, ese cliente queda preseleccionado
    if (this.contexto) { this.idexpediente = this.contexto; this.cargarDatos() }
    this.cargandoClientes = true
    this.service.listarClientes().subscribe({
      next: (resp) => {
        this.clientes = resp.data ?? []
        this.cargandoClientes = false
        // Si estás en el expediente de una pareja, queda seleccionada la pareja
        if (this.contexto) this.idexpediente = principalDe(this.contexto, this.clientes)
        this.cargarDatos()
      },
      error: () => { this.cargandoClientes = false }
    })
  }

  // ---- Notas anteriores y expediente del cliente elegido ----
  alCambiarCliente(id: string | null) {
    this.idexpediente = id
    this.cargarDatos()
  }

  private cargarDatos() {
    this.cargarNotas()
    this.cargarFormularios()
    const id = this.idexpediente
    if (!id) { this.personas = []; this.archivos = []; return }
    this.cargandoExpediente = true
    this.service.obtenerCliente(id).subscribe({
      next: (resp) => {
        const c: Cliente = resp.data
        this.personas = c?.integrantes?.length ? c.integrantes : c ? [c] : []
        this.cargandoExpediente = false
      },
      error: () => { this.personas = []; this.cargandoExpediente = false }
    })
    this.service.listarArchivos(id).subscribe({
      next: (resp) => { this.archivos = resp.data ?? [] },
      error: () => { this.archivos = [] }
    })
  }

  cargarFormularios() {
    const id = this.idexpediente
    if (!id) { this.formularios = []; return }
    this.cargandoFormularios = true
    this.service.listarFormularios(id, true).subscribe({
      next: (resp) => { this.formularios = resp.data ?? []; this.cargandoFormularios = false },
      error: () => { this.cargandoFormularios = false }
    })
  }

  get respondidos(): number { return this.formularios.filter(f => f.estado === 'enviado').length }
  get esParejaForm(): boolean { return new Set(this.formularios.map(f => f.idexpediente)).size > 1 }
  valorRespuesta(v: any): string { return Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '—' : String(v) }
  etiquetaEstadoForm(e: string): string { return ({ borrador: 'Sin URL', abierto: 'Esperando respuesta', enviado: 'Respondido', cerrado: 'Cerrado', vencido: 'Enlace vencido' } as any)[e] ?? e }
  claseEstadoForm(e: string): string {
    return e === 'enviado' ? 'bg-emerald-100 text-emerald-800' : e === 'abierto' ? 'bg-sky-100 text-sky-800' : e === 'vencido' ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-600'
  }

  cargarNotas() {
    const id = this.idexpediente
    if (!id) { this.notas = []; return }
    this.cargandoNotas = true
    this.service.listarNotas(id).subscribe({
      next: (resp) => { this.notas = resp.data ?? []; this.cargandoNotas = false },
      error: () => { this.cargandoNotas = false }
    })
  }

  claseTipo(t: string) { return claseTipo(t) }
  etiquetaTipo(t: string) { return etiquetaTipo(t) }
  icono(nombre: string) { return iconoArchivo(nombre) }
  tamano(bytes: number | null) { return formatoTamano(bytes) }

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
          if (this.lateral) this.pestana = 'notas'  // sigues en la llamada: la nota aparece en la lista
          else this.abierto = false
        }
      },
      error: (err) => {
        this.guardando = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo guardar la nota')
      }
    })
  }
}
