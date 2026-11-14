import { Component, OnInit } from '@angular/core';
import { Cliente, Formulario, FormularioGlobal, Plantilla, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { opcionesCliente } from 'src/app/utils/tipos';
import { ToastService } from 'src/app/services/toast.service';
import { BorradorFormulario, modeloDatos } from '../constructor-formulario/constructor-formulario.component';

// Sección general de formularios: plantillas que se crean una vez y se asignan a cada cliente cuando hace falta.
@Component({
  selector: 'app-formularios',
  templateUrl: './formularios.component.html',
  styleUrls: ['./formularios.component.css']
})
export class FormulariosComponent implements OnInit {
  public plantillas: Plantilla[] = []
  public cargando = true
  public seguimiento: FormularioGlobal[] = []
  public cargandoSeguimiento = true

  // Constructor
  public constructorAbierto = false
  public editando: Plantilla | null = null
  public borrador: BorradorFormulario = modeloDatos()
  public guardando = false

  // Asignar a un cliente
  public asignar: Plantilla | null = null
  public clientesLista: Cliente[] = []
  public idexpedienteAsignar: string | null = null
  public dias = 7
  public asignando = false
  public resultados: Formulario[] = []
  public copiado: string | null = null

  constructor(private service: ServiceclientesService, private toast: ToastService) { }

  ngOnInit(): void { this.cargar() }

  cargar() {
    this.service.listarPlantillas().subscribe({
      next: (r) => { this.plantillas = r.data ?? []; this.cargando = false },
      error: (err) => { this.cargando = false; this.toast.error(err.error?.message?.trim() || 'No se pudieron cargar las plantillas') }
    })
    this.cargarSeguimiento()
  }

  private cargarSeguimiento() {
    this.service.listarFormulariosGlobal().subscribe({
      next: (r) => { this.seguimiento = r.data ?? []; this.cargandoSeguimiento = false },
      error: () => { this.cargandoSeguimiento = false }
    })
  }

  // ---- Plantillas ----
  nueva() { this.editando = null; this.borrador = modeloDatos(); this.constructorAbierto = true }
  editar(p: Plantilla) {
    this.editando = p
    this.borrador = { titulo: p.titulo, descripcion: p.descripcion ?? '', campos: p.campos }
    this.constructorAbierto = true
  }

  guardar(b: BorradorFormulario) {
    if (this.guardando) return
    this.guardando = true
    const llamada = this.editando ? this.service.editarPlantilla(this.editando.id, b) : this.service.crearPlantilla(b)
    llamada.subscribe({
      next: () => {
        this.guardando = false; this.constructorAbierto = false
        this.toast.success(this.editando ? 'Plantilla guardada' : 'Plantilla creada')
        this.editando = null; this.cargar()
      },
      error: (err) => { this.guardando = false; this.toast.error(err.error?.message?.trim() || 'No se pudo guardar la plantilla') }
    })
  }

  eliminar(p: Plantilla) {
    if (!confirm(`¿Eliminar la plantilla "${p.titulo}"? Los formularios que ya enviaste a clientes no se borran.`)) return
    this.service.eliminarPlantilla(p.id).subscribe({
      next: () => { this.toast.success('Plantilla eliminada'); this.cargar() },
      error: (err) => this.toast.error(err.error?.message?.trim() || 'No se pudo eliminar la plantilla')
    })
  }

  tieneArchivos(p: Plantilla) { return p.campos.some(c => c.tipo === 'archivo') }

  // ---- Asignar a un cliente ----
  abrirAsignar(p: Plantilla) {
    this.asignar = p
    this.idexpedienteAsignar = null
    this.resultados = []
    this.copiado = null
    if (!this.clientesLista.length) {
      this.service.listarClientes().subscribe({ next: (r) => { this.clientesLista = r.data ?? [] }, error: () => { } })
    }
  }

  get opcionesClientes() { return opcionesCliente(this.clientesLista) }

  confirmarAsignar() {
    if (!this.asignar || !this.idexpedienteAsignar || this.asignando) return
    this.asignando = true
    this.service.asignarPlantilla(this.asignar.id, { idexpediente: this.idexpedienteAsignar, generarUrl: true, dias: this.dias }).subscribe({
      next: (r) => { this.asignando = false; this.resultados = r.todos ?? [r.data]; this.cargarSeguimiento(); this.toast.success(this.resultados.length > 1 ? 'Formularios asignados: uno para cada persona' : 'Formulario asignado') },
      error: (err) => { this.asignando = false; this.toast.error(err.error?.message?.trim() || 'No se pudo asignar el formulario') }
    })
  }

  async copiarUrl(f: Formulario) {
    if (!f.url) return
    try { await navigator.clipboard.writeText(f.url); this.copiado = f.id; this.toast.success('URL copiada') }
    catch { this.toast.error('No se pudo copiar la URL') }
  }

  // Cada persona recibe su enlace en su propio teléfono
  enlaceWhatsapp(f: Formulario): string {
    const tel = (f.cliente_telefono ?? '').replace(/[^\d]/g, '')
    const texto = encodeURIComponent(`Hola, por favor completa este formulario: ${f.url}`)
    return tel.length >= 7 ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`
  }

  // ¿El cliente elegido es una pareja?
  get esPareja(): boolean {
    const c = this.clientesLista.find(x => x.idexpediente === this.idexpedienteAsignar)
    return !!c?.idgrupo
  }

  cerrarAsignar() { this.asignar = null; this.resultados = [] }

  // ---- Presentación ----
  etiquetaEstado(e: string): string { return ({ borrador: 'Sin URL', abierto: 'Enlace activo', enviado: 'Respondido', cerrado: 'Cerrado', vencido: 'Enlace vencido' } as any)[e] ?? e }
  claseEstado(e: string): string {
    return e === 'enviado' ? 'bg-emerald-100 text-emerald-800' : e === 'abierto' ? 'bg-sky-100 text-sky-800' : e === 'vencido' ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-600'
  }
}
