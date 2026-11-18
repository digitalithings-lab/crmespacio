import { AfterViewChecked, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { ServiceclientesService } from 'src/app/services/serviceclientes.service';

interface Mensaje { role: 'user' | 'assistant'; content: string; error?: boolean }

const ETIQUETAS: Record<string, string> = {
  buscar_clientes: 'Buscó clientes', resumen_expediente: 'Leyó el expediente', ver_agenda: 'Consultó la agenda',
  crear_nota: 'Guardó una nota', crear_cobro: 'Creó un cobro'
}

// Conversación con el asistente de IA. Se usa en la página "Chat con IA" y dentro de la videollamada.
@Component({
  selector: 'app-chat-ia',
  templateUrl: './chat-ia.component.html'
})
export class ChatIaComponent implements AfterViewChecked {
  // Paciente que se está atendiendo (el asistente entiende "este paciente")
  @Input() idexpediente: string | null = null
  @Input() contexto: 'panel' | 'sala' = 'panel'
  @Input() sugerencias: string[] = []

  @ViewChild('fin') fin?: ElementRef<HTMLElement>

  public mensajes: Mensaje[] = []
  public texto = ''
  public pensando = false
  public acciones: string[] = []
  private bajar = false

  constructor(private service: ServiceclientesService) { }

  ngAfterViewChecked(): void {
    if (this.bajar) { this.bajar = false; this.fin?.nativeElement.scrollIntoView({ block: 'end', behavior: 'smooth' }) }
  }

  enviar(texto?: string) {
    const t = (texto ?? this.texto).trim()
    if (!t || this.pensando) return
    this.mensajes.push({ role: 'user', content: t })
    this.texto = ''
    this.pensando = true
    this.bajar = true
    const historial = this.mensajes.filter(m => !m.error).map(({ role, content }) => ({ role, content }))
    this.service.chatIA(historial, this.idexpediente, this.contexto).subscribe({
      next: (resp) => {
        this.mensajes.push({ role: 'assistant', content: resp.respuesta })
        this.acciones = (resp.acciones ?? []).map((a: string) => ETIQUETAS[a] ?? a)
        this.pensando = false; this.bajar = true
      },
      error: (err) => {
        this.mensajes.push({ role: 'assistant', content: err.error?.message?.trim() || 'No se pudo hablar con la IA', error: true })
        this.pensando = false; this.bajar = true
      }
    })
  }

  limpiar() { this.mensajes = []; this.acciones = [] }

  alTeclear(e: Event) {
    const ev = e as KeyboardEvent
    if (ev.shiftKey) return
    ev.preventDefault()
    this.enviar()
  }

  // Texto del asistente → HTML sencillo (negritas, listas, saltos). Angular lo sanea.
  formatear(t: string): string {
    const esc = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const lineas = esc.split('\n')
    let html = ''; let lista = false
    for (const l of lineas) {
      const item = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
      const cuerpo = (item ? item[1] : l).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      if (item) { if (!lista) { html += '<ul class="my-1 list-disc space-y-0.5 pl-5">'; lista = true } html += `<li>${cuerpo}</li>` }
      else {
        if (lista) { html += '</ul>'; lista = false }
        if (/^#{1,4}\s/.test(l)) html += `<p class="mt-2 font-bold">${cuerpo.replace(/^#{1,4}\s/, '')}</p>`
        else if (l.trim()) html += `<p class="mt-1">${cuerpo}</p>`
      }
    }
    return html + (lista ? '</ul>' : '')
  }
}
