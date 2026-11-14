import { Component, HostListener, OnInit } from '@angular/core';
import { of, switchMap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { Cliente, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { claseEstado, claseTipo, detalleEstado, ESTADOS, etiquetaEstado, etiquetaTipo, nombreGrupo, TIPOS } from 'src/app/utils/tipos';
import { ToastService } from 'src/app/services/toast.service';

// Una fila de la tabla: un cliente, o una pareja (dos clientes con el mismo idgrupo)
export interface Fila {
  principal: Cliente
  integrantes: Cliente[]
}

@Component({
  selector: 'app-clientes',
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.css']
})
export class ClientesComponent implements OnInit {
  public clientes: Cliente[] = []
  public cargando = true
  public abierto = false
  public guardando = false

  public busqueda = ''
  public filtroTipo = ''
  public filtroEstado = ''
  public estados = ESTADOS
  public tipos = TIPOS

  // Formulario
  public nombre = ''
  public apellido = ''
  public correo = ''
  public cedula = ''
  public telefono = ''
  public edad: number | null = null
  public tipo = 'individual'

  // Datos de la pareja (solo cuando el tipo es pareja)
  public pNombre = ''
  public pApellido = ''
  public pCorreo = ''
  public pCedula = ''
  public pTelefono = ''
  public pEdad: number | null = null

  constructor(
    private service: ServiceclientesService,
    private toast: ToastService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.cargar()
    // Desde el dashboard: /clientes?nuevo=1 abre el formulario directamente
    if (this.route.snapshot.queryParamMap.get('nuevo')) this.abrir()
  }

  cargar() {
    this.cargando = true
    this.service.listarClientes().subscribe({
      next: (resp) => {
        this.clientes = resp.data ?? []
        this.cargando = false
      },
      error: () => {
        this.cargando = false
        this.toast.error('No se pudieron cargar los clientes')
      }
    })
  }

  // Agrupa a las parejas en una sola fila (la principal es la primera persona registrada)
  get filas(): Fila[] {
    const filas: Fila[] = []
    const porGrupo = new Map<string, Fila>()
    for (const c of this.clientes) {
      if (c.idgrupo) {
        const f = porGrupo.get(c.idgrupo)
        if (f) { f.integrantes.push(c); continue }
        const nueva: Fila = { principal: c, integrantes: [c] }
        porGrupo.set(c.idgrupo, nueva)
        filas.push(nueva)
      } else {
        filas.push({ principal: c, integrantes: [c] })
      }
    }
    filas.forEach(f => {
      f.integrantes.sort((a, b) => a.id - b.id)
      f.principal = f.integrantes[0]
    })
    return filas
  }

  get filtrados(): Fila[] {
    const q = this.busqueda.trim().toLowerCase()
    return this.filas.filter(f =>
      (!this.filtroTipo || f.principal.tipo === this.filtroTipo) &&
      (!this.filtroEstado || f.principal.estado === this.filtroEstado) &&
      (!q || f.integrantes.some(c => `${c.nombre} ${c.apellido} ${c.correo} ${c.cedula}`.toLowerCase().includes(q)))
    )
  }

  nombreFila(f: Fila) { return nombreGrupo(f.integrantes) }

  iniciales(c: Cliente) {
    return `${c.nombre?.[0] ?? ''}${c.apellido?.[0] ?? ''}`.toUpperCase()
  }


  // Cuántos clientes hay en cada estado (una pareja cuenta como uno)
  cuantos(estado: string): number { return this.filas.filter(f => f.principal.estado === estado).length }
  claseEstado(e?: string | null) { return claseEstado(e) }
  etiquetaEstado(e?: string | null) { return etiquetaEstado(e) }
  detalleEstado(c: Cliente) { return detalleEstado(c) }

  claseTipo(tipo: string) { return claseTipo(tipo) }
  etiquetaTipo(tipo: string) { return etiquetaTipo(tipo) }

  ver(f: Fila) {
    this.router.navigate(['/clientes', f.principal.idexpediente])
  }

  abrir() { this.abierto = true }

  @HostListener('document:keydown.escape')
  cerrar() { if (!this.guardando) this.abierto = false }

  guardar() {
    if (this.guardando) return
    this.guardando = true
    const esPareja = this.tipo === 'pareja'
    // Las dos personas de la pareja comparten el mismo grupo
    const idgrupo = esPareja ? this.nuevoId() : undefined
    const persona1 = {
      nombre: this.nombre.trim(),
      apellido: this.apellido.trim(),
      correo: this.correo.trim(),
      cedula: this.cedula.trim(),
      telefono: this.telefono.trim(),
      edad: this.edad,
      tipo: this.tipo,
      idgrupo
    }
    const persona2 = {
      nombre: this.pNombre.trim(),
      apellido: this.pApellido.trim(),
      correo: this.pCorreo.trim(),
      cedula: this.pCedula.trim(),
      telefono: this.pTelefono.trim(),
      edad: this.pEdad,
      tipo: this.tipo,
      idgrupo
    }
    this.service.crearCliente(persona1).pipe(
      switchMap((r) => esPareja ? this.service.crearCliente(persona2) : of(r))
    ).subscribe({
      next: (resp) => {
        this.guardando = false
        if (resp.ok === true) {
          this.toast.success(esPareja ? 'Pareja creada con éxito' : 'Cliente creado con éxito')
          this.limpiar()
          this.abierto = false
          this.cargar()
        }
      },
      error: (err) => {
        this.guardando = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo crear el cliente')
        this.cargar() // por si la primera persona sí se guardó
      }
    })
  }

  private nuevoId(): string {
    return (crypto as any).randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
        })
  }

  private limpiar() {
    this.nombre = this.apellido = this.correo = this.cedula = this.telefono = ''
    this.edad = null
    this.pNombre = this.pApellido = this.pCorreo = this.pCedula = this.pTelefono = ''
    this.pEdad = null
    this.tipo = 'individual'
  }
}
