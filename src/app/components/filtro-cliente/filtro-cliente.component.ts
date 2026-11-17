import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OpcionCliente } from 'src/app/utils/tipos';

// «Filtrar por cliente»: un botón que abre el buscador de clientes y deja el elegido como etiqueta.
@Component({
  selector: 'app-filtro-cliente',
  templateUrl: './filtro-cliente.component.html',
  styleUrls: ['./filtro-cliente.component.css']
})
export class FiltroClienteComponent {
  @Input() opciones: OpcionCliente[] = []
  @Input() valor: string | null = null
  @Output() valorChange = new EventEmitter<string | null>()

  public abierto = false

  get elegido() { return this.opciones.find(o => o.valor === this.valor) }

  elegir(id: string | null) {
    this.valor = id
    this.valorChange.emit(id)
    if (id) this.abierto = false
  }
}
