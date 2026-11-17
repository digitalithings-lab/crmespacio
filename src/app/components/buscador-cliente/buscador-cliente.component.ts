import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OpcionCliente } from 'src/app/utils/tipos';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Buscador de clientes: un campo que filtra mientras escribes y, debajo, la lista de clientes para elegir.
@Component({
  selector: 'app-buscador-cliente',
  templateUrl: './buscador-cliente.component.html',
  styleUrls: ['./buscador-cliente.component.css']
})
export class BuscadorClienteComponent {
  @Input() opciones: OpcionCliente[] = []
  @Input() valor: string | null = null
  @Output() valorChange = new EventEmitter<string | null>()

  public busqueda = ''

  get filtradas(): OpcionCliente[] {
    const q = normalizar(this.busqueda.trim())
    return q ? this.opciones.filter(o => normalizar(o.etiqueta).includes(q)) : this.opciones
  }

  get elegida(): OpcionCliente | undefined {
    return this.opciones.find(o => o.valor === this.valor)
  }

  elegir(o: OpcionCliente) {
    this.valor = o.valor
    this.valorChange.emit(o.valor)
  }

  quitar() {
    this.valor = null
    this.valorChange.emit(null)
  }
}
