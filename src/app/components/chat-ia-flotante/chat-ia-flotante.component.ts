import { Component, Input } from '@angular/core';

// Botón + panel lateral con el asistente, para usarlo durante la videollamada
@Component({
  selector: 'app-chat-ia-flotante',
  templateUrl: './chat-ia-flotante.component.html'
})
export class ChatIaFlotanteComponent {
  @Input() idexpediente: string | null = null
  @Input() posicion = 'bottom-6 right-6'
  public abierto = false

  public sugerencias = ['Resumen rápido de su expediente', '¿Qué hablamos en la última sesión?', '¿Qué preguntas me sugieres explorar hoy?']
}
