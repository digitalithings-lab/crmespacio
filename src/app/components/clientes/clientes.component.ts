import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Cliente, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { ToastService } from 'src/app/services/toast.service';

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
  public tipos = ['Pareja', 'Individual', 'Niños/Adolescentes']

  // Formulario
  public nombre = ''
  public apellido = ''
  public correo = ''
  public cedula = ''
  public telefono = ''
  public edad: number | null = null
  public tipo = 'Individual'

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

  get filtrados(): Cliente[] {
    const q = this.busqueda.trim().toLowerCase()
    return this.clientes.filter(c =>
      (!this.filtroTipo || c.tipo === this.filtroTipo) &&
      (!q || `${c.nombre} ${c.apellido} ${c.correo} ${c.cedula}`.toLowerCase().includes(q))
    )
  }

  iniciales(c: Cliente) {
    return `${c.nombre?.[0] ?? ''}${c.apellido?.[0] ?? ''}`.toUpperCase()
  }

  claseTipo(tipo: string) {
    if (tipo === 'Pareja') return 'bg-brand-50 text-brand-700'
    if (tipo === 'Niños/Adolescentes') return 'bg-amber-50 text-amber-800'
    return 'bg-zinc-100 text-zinc-700'
  }

  ver(c: Cliente) {
    this.router.navigate(['/clientes', c.idexpediente])
  }

  abrir() { this.abierto = true }

  @HostListener('document:keydown.escape')
  cerrar() { if (!this.guardando) this.abierto = false }

  guardar() {
    if (this.guardando) return
    this.guardando = true
    const data = {
      nombre: this.nombre.trim(),
      apellido: this.apellido.trim(),
      correo: this.correo.trim(),
      cedula: this.cedula.trim(),
      telefono: this.telefono.trim(),
      edad: this.edad,
      tipo: this.tipo
    }
    this.service.crearCliente(data).subscribe({
      next: (resp) => {
        this.guardando = false
        if (resp.ok === true) {
          this.toast.success('Cliente creado con éxito')
          this.limpiar()
          this.abierto = false
          this.cargar()
        }
      },
      error: (err) => {
        this.guardando = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo crear el cliente')
      }
    })
  }

  private limpiar() {
    this.nombre = this.apellido = this.correo = this.cedula = this.telefono = ''
    this.edad = null
    this.tipo = 'Individual'
  }
}
