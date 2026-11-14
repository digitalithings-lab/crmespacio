import { Component, OnInit } from '@angular/core';
import { Archivo, Cliente, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { opcionesCliente } from 'src/app/utils/tipos';
import { categoriaArchivo, formatoTamano, iconoArchivo } from 'src/app/utils/archivos';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-biblioteca',
  templateUrl: './biblioteca.component.html',
  styleUrls: ['./biblioteca.component.css']
})
export class BibliotecaComponent implements OnInit {
  public archivos: Archivo[] = []
  public clientes: Cliente[] = []
  public cargando = true
  public subiendo = false
  public arrastrando = false
  // 'propio' = archivo mío, sin cliente; si no, el idexpediente del cliente elegido
  public idexpediente: string | null = 'propio'

  public filtro = 'Todos'
  public filtros = ['Todos', 'Documentos', 'Imágenes', 'Otros']
  // Mis archivos (sin cliente) o los de los expedientes
  public origen = 'Todos'
  public origenes = ['Todos', 'Míos', 'De clientes']

  constructor(private service: ServiceclientesService, private toast: ToastService) { }

  ngOnInit(): void {
    this.cargar()
    this.service.listarClientes().subscribe({
      next: (resp) => (this.clientes = resp.data ?? [])
    })
  }

  cargar() {
    this.service.listarArchivos().subscribe({
      next: (resp) => { this.archivos = resp.data ?? []; this.cargando = false },
      error: () => { this.cargando = false; this.toast.error('No se pudieron cargar los archivos') }
    })
  }

  get opciones() { return opcionesCliente(this.clientes) }

  get filtrados(): Archivo[] {
    const porTipo = this.filtro === 'Todos' ? this.archivos : this.archivos.filter(a => categoriaArchivo(a.documento) === this.filtro)
    return this.origen === 'Todos' ? porTipo : porTipo.filter(a => (this.origen === 'Míos') === !!a.propio)
  }

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
    if (!this.idexpediente) {
      this.toast.info('Elige si el archivo es tuyo o de un cliente')
      return
    }
    const propio = this.idexpediente === 'propio'
    this.subiendo = true
    for (const file of files) {
      if (file.size > 4 * 1024 * 1024) {
        this.toast.error(`"${file.name}" supera el límite de 4 MB`)
        continue
      }
      try {
        await new Promise<void>((ok, fail) =>
          (propio ? this.service.subirArchivoPropio(file) : this.service.subirArchivo(this.idexpediente!, file))
            .subscribe({ next: () => ok(), error: (e) => fail(e) })
        )
        this.toast.success(`"${file.name}" subido`)
      } catch (e: any) {
        this.toast.error(e?.error?.message?.trim() || `No se pudo subir "${file.name}"`)
      }
    }
    this.subiendo = false
    this.cargar()
  }

  icono(nombre: string) { return iconoArchivo(nombre) }
  tamano(bytes: number | null) { return formatoTamano(bytes) }
}
