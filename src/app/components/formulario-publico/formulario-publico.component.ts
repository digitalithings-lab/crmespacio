import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CampoForm, ServiceclientesService } from 'src/app/services/serviceclientes.service';

type Estado = 'cargando' | 'listo' | 'enviado' | 'error'
interface Subido { nombre: string; estado: 'subiendo' | 'ok' | 'error'; mensaje?: string }

const MAX_BYTES = 4 * 1024 * 1024

// Reduce las fotos del celular (suelen pesar 5 a 10 MB) antes de subirlas, para que suban rápido y quepan en el límite.
async function comprimir(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 900 * 1024) return file
  try {
    const bmp = await createImageBitmap(file)
    const escala = Math.min(1, 1800 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * escala)
    canvas.height = Math.round(bmp.height * escala)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob: Blob | null = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.82))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}

// Página pública: la persona llena los datos y sube fotos o archivos (sin cuenta)
@Component({
  selector: 'app-formulario-publico',
  templateUrl: './formulario-publico.component.html',
  styleUrls: ['./formulario-publico.component.css']
})
export class FormularioPublicoComponent implements OnInit {
  public token = ''
  public estado: Estado = 'cargando'
  public mensaje = ''
  public titulo = ''
  public descripcion = ''
  public nombre = ''
  public campos: CampoForm[] = []
  public valores: { [id: string]: any } = {}
  public subidos: { [id: string]: Subido[] } = {}
  public enviando = false
  public error = ''

  constructor(private route: ActivatedRoute, private service: ServiceclientesService) { }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? ''
    this.service.verFormularioPublico(this.token).subscribe({
      next: (r) => {
        const d = r.data
        this.titulo = d.titulo; this.descripcion = d.descripcion ?? ''; this.nombre = d.nombre ?? ''; this.campos = d.campos
        this.campos.forEach(c => { if (c.tipo === 'casillas') this.valores[c.id!] = []; if (c.tipo === 'archivo') this.subidos[c.id!] = [] })
        document.title = this.titulo
        this.estado = 'listo'
      },
      error: (err) => {
        this.estado = err.error?.enviado ? 'enviado' : 'error'
        this.mensaje = err.error?.message || 'No se pudo abrir el formulario. Revisa que el enlace esté completo.'
      }
    })
  }

  alternarCasilla(id: string, opcion: string) {
    const lista: string[] = this.valores[id] ?? []
    this.valores[id] = lista.includes(opcion) ? lista.filter(o => o !== opcion) : [...lista, opcion]
  }

  async elegirArchivos(c: CampoForm, event: Event) {
    const input = event.target as HTMLInputElement
    const archivos = Array.from(input.files ?? [])
    input.value = ''
    for (const original of archivos) {
      const lista = this.subidos[c.id!]
      if (lista.filter(s => s.estado !== 'error').length >= (c.max ?? 3)) {
        this.error = `Puedes subir hasta ${c.max ?? 3} archivos en "${c.etiqueta}".`
        break
      }
      const item: Subido = { nombre: original.name, estado: 'subiendo' }
      lista.push(item)
      const file = await comprimir(original)
      if (file.size > MAX_BYTES) { item.estado = 'error'; item.mensaje = 'Pesa más de 4 MB'; continue }
      try {
        await new Promise<void>((ok, fail) => this.service.subirArchivoFormulario(this.token, c.id!, file).subscribe({ next: () => ok(), error: (e) => fail(e) }))
        item.estado = 'ok'
      } catch (e: any) {
        item.estado = 'error'
        item.mensaje = e?.error?.message || 'No se pudo subir'
      }
    }
  }

  get subiendo(): boolean { return Object.values(this.subidos).some(l => l.some(s => s.estado === 'subiendo')) }

  enviar() {
    if (this.enviando || this.subiendo) return
    this.error = ''
    this.enviando = true
    this.service.enviarFormulario(this.token, this.valores).subscribe({
      next: () => { this.enviando = false; this.estado = 'enviado' },
      error: (err) => {
        this.enviando = false
        if (err.error?.enviado) { this.estado = 'enviado'; return }
        this.error = err.error?.message || 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.'
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }
}
