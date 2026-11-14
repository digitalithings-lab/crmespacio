import { Component, OnInit } from '@angular/core';
import { ArchivoPropio, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { categoriaArchivo, formatoTamano, iconoArchivo } from 'src/app/utils/archivos';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-biblioteca-personal',
  templateUrl: './biblioteca-personal.component.html',
  styleUrls: ['./biblioteca-personal.component.css']
})
export class BibliotecaPersonalComponent implements OnInit {
  public archivos: ArchivoPropio[] = []
  public cargando = true
  public subiendo = false
  public arrastrando = false

  public filtro = 'Todos'
  public filtros = ['Todos', 'Documentos', 'Imágenes', 'Otros']

  constructor(private service: ServiceclientesService, private toast: ToastService) { }

  ngOnInit(): void { this.cargar() }

  cargar() {
    this.service.listarArchivosPropios().subscribe({
      next: (resp) => { this.archivos = resp.data ?? []; this.cargando = false },
      error: () => { this.cargando = false; this.toast.error('No se pudieron cargar tus archivos') }
    })
  }

  get filtrados(): ArchivoPropio[] {
    return this.filtro === 'Todos' ? this.archivos : this.archivos.filter(a => categoriaArchivo(a.documento) === this.filtro)
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
    this.subiendo = true
    for (const file of files) {
      if (file.size > 4 * 1024 * 1024) {
        this.toast.error(`"${file.name}" supera el límite de 4 MB`)
        continue
      }
      try {
        await new Promise<void>((ok, fail) =>
          this.service.subirArchivoPropio(file).subscribe({ next: () => ok(), error: (e) => fail(e) })
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
