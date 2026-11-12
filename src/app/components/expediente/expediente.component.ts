import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Archivo, Cliente, Nota, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { formatoTamano, iconoArchivo } from 'src/app/utils/archivos';
import { ServicesalaService } from 'src/app/services/servicesala.service';
import { ToastService } from 'src/app/services/toast.service';

type Pestana = 'expediente' | 'notas' | 'biblioteca' | 'reuniones'

@Component({
  selector: 'app-expediente',
  templateUrl: './expediente.component.html',
  styleUrls: ['./expediente.component.css']
})
export class ExpedienteComponent implements OnInit, OnDestroy {
  public id = ''
  public cliente: Cliente | null = null
  public cargando = true
  public noEncontrado = false
  public tab: Pestana = 'expediente'

  public notas: Nota[] = []
  public cargandoNotas = true
  public archivos: Archivo[] = []
  public cargandoArchivos = true
  public subiendo = false
  public arrastrando = false

  public salas: any[] = []
  public cargandoSalas = true
  public creandoSala = false
  public nombreSala = ''

  private sub?: Subscription

  constructor(
    private route: ActivatedRoute,
    private service: ServiceclientesService,
    private salaService: ServicesalaService,
    private toast: ToastService
  ) { }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? ''
    // La nota flotante preselecciona a este cliente mientras estés en su expediente
    this.service.clienteContexto.next(this.id)
    this.cargarCliente()
    this.cargarNotas()
    this.cargarArchivos()
    this.cargarSalas()
    this.sub = this.service.notasActualizadas$.subscribe(() => this.cargarNotas())
  }

  ngOnDestroy(): void {
    this.service.clienteContexto.next(null)
    this.sub?.unsubscribe()
  }

  cargarCliente() {
    this.service.obtenerCliente(this.id).subscribe({
      next: (resp) => { this.cliente = resp.data; this.cargando = false },
      error: () => { this.cargando = false; this.noEncontrado = true }
    })
  }

  cargarNotas() {
    this.service.listarNotas(this.id).subscribe({
      next: (resp) => { this.notas = resp.data ?? []; this.cargandoNotas = false },
      error: () => { this.cargandoNotas = false }
    })
  }

  cargarArchivos() {
    this.service.listarArchivos(this.id).subscribe({
      next: (resp) => { this.archivos = resp.data ?? []; this.cargandoArchivos = false },
      error: () => { this.cargandoArchivos = false }
    })
  }

  cargarSalas() {
    this.salaService.listarSalas(this.id).subscribe({
      next: (resp) => { this.salas = resp.data ?? []; this.cargandoSalas = false },
      error: () => { this.cargandoSalas = false }
    })
  }

  crearReunion() {
    if (this.creandoSala) return
    this.creandoSala = true
    this.salaService.crearSala(this.id, this.nombreSala.trim()).subscribe({
      next: () => {
        this.creandoSala = false
        this.nombreSala = ''
        this.toast.success('Reunión creada')
        this.cargarSalas()
      },
      error: (err) => {
        this.creandoSala = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo crear la reunión')
      }
    })
  }

  async copiarEnlace(codigo: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/sala/${codigo}`)
      this.toast.success('Enlace copiado')
    } catch {
      this.toast.error('No se pudo copiar el enlace')
    }
  }

  cambiar(t: Pestana) { this.tab = t }

  nuevaNota() { this.service.abrirNota() }

  // ---- Archivos ----
  alElegir(event: Event) {
    const input = event.target as HTMLInputElement
    this.subir(Array.from(input.files ?? []))
    input.value = ''
  }

  alSoltar(event: DragEvent) {
    event.preventDefault()
    this.arrastrando = false
    this.subir(Array.from(event.dataTransfer?.files ?? []))
  }

  alArrastrar(event: DragEvent) {
    event.preventDefault()
    this.arrastrando = true
  }

  private async subir(files: File[]) {
    if (!files.length || this.subiendo) return
    this.subiendo = true
    for (const file of files) {
      if (file.size > 4 * 1024 * 1024) {
        this.toast.error(`"${file.name}" supera el límite de 4 MB`)
        continue
      }
      try {
        await new Promise<void>((ok, fail) =>
          this.service.subirArchivo(this.id, file).subscribe({ next: () => ok(), error: (e) => fail(e) })
        )
        this.toast.success(`"${file.name}" subido`)
      } catch (e: any) {
        this.toast.error(e?.error?.message?.trim() || `No se pudo subir "${file.name}"`)
      }
    }
    this.subiendo = false
    this.cargarArchivos()
  }

  // ---- Presentación ----
  iniciales() {
    const c = this.cliente
    return c ? `${c.nombre?.[0] ?? ''}${c.apellido?.[0] ?? ''}`.toUpperCase() : ''
  }

  claseTipo(tipo: string) {
    if (tipo === 'Pareja') return 'bg-brand-50 text-brand-700'
    if (tipo === 'Niños/Adolescentes') return 'bg-amber-50 text-amber-800'
    return 'bg-zinc-100 text-zinc-700'
  }

  icono(nombre: string) { return iconoArchivo(nombre) }
  tamano(bytes: number | null) { return formatoTamano(bytes) }
}
