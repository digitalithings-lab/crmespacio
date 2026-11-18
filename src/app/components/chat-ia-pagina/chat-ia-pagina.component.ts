import { Component, OnInit } from '@angular/core';
import { Cliente, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { opcionesCliente } from 'src/app/utils/tipos';

@Component({
  selector: 'app-chat-ia-pagina',
  templateUrl: './chat-ia-pagina.component.html'
})
export class ChatIaPaginaComponent implements OnInit {
  public clientes: Cliente[] = []
  public idexpediente: string | null = null

  constructor(private service: ServiceclientesService) { }

  ngOnInit(): void {
    this.service.listarClientes().subscribe({ next: (resp) => (this.clientes = resp.data ?? []) })
  }

  get opciones() { return opcionesCliente(this.clientes) }

  get sugerencias(): string[] {
    return this.idexpediente
      ? ['Hazme un resumen de su expediente', '¿Qué temas debería retomar hoy?', '¿Tiene pagos pendientes?', 'Resume sus últimas notas']
      : ['¿Qué citas tengo hoy?', '¿Qué citas tengo esta semana?', 'Busca a un paciente y resume su expediente']
  }
}
