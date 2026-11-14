import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { Archivo, Billetera, CampoForm, Cliente, Cobro, Formulario, Nota, TipoCampo, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { formatoTamano, iconoArchivo } from 'src/app/utils/archivos';
import { ServicesalaService } from 'src/app/services/servicesala.service';
import { claseEstado, claseTipo, detalleEstado, etiquetaEstado, etiquetaTipo, nombreGrupo } from 'src/app/utils/tipos';
import { ToastService } from 'src/app/services/toast.service';

type Pestana = 'expediente' | 'notas' | 'biblioteca' | 'reuniones' | 'billetera' | 'formularios'

@Component({
  selector: 'app-expediente',
  templateUrl: './expediente.component.html',
  styleUrls: ['./expediente.component.css']
})
export class ExpedienteComponent implements OnInit, OnDestroy {
  public id = ''
  public cliente: Cliente | null = null
  public cargando = true
  public noEncontrado = false
  public tab: Pestana = 'expediente'

  public notas: Nota[] = []
  public cargandoNotas = true
  public archivos: Archivo[] = []
  public cargandoArchivos = true
  public subiendo = false
  public arrastrando = false

  public salas: any[] = []
  public cargandoSalas = true
  public creandoSala = false
  public nombreSala = ''

  // Formularios
  public formularios: Formulario[] = []
  public cargandoFormularios = true
  public constructorAbierto = false
  public guardandoForm = false
  public nuevoForm = this.formVacio()
  public tiposCampo: { valor: TipoCampo; etiqueta: string }[] = [
    { valor: 'texto', etiqueta: 'Texto corto' }, { valor: 'parrafo', etiqueta: 'Texto largo' }, { valor: 'numero', etiqueta: 'Número' },
    { valor: 'fecha', etiqueta: 'Fecha' }, { valor: 'correo', etiqueta: 'Correo' }, { valor: 'telefono', etiqueta: 'Teléfono' },
    { valor: 'opcion', etiqueta: 'Elegir una opción' }, { valor: 'casillas', etiqueta: 'Varias opciones' }, { valor: 'sino', etiqueta: 'Sí / No' },
    { valor: 'archivo', etiqueta: 'Adjuntar fotos o archivos' },
  ]
  public diasUrl = 7
  public ocupadoForm: { [id: string]: boolean } = {}
  public respuestas: { formulario: Formulario; respuestas: any[] } | null = null
  public copiado: string | null = null

  // Billetera
  public billetera: Billetera | null = null
  public cargandoBilletera = true
  public correoConfigurado = true
  public correoFaltan: string[] = []
  public formCobro = { concepto: '', monto: '', moneda: 'USD', codigo_sala: '' }
  public creandoCobro = false
  public cobroPagando: Cobro | null = null   // cobro cuyo formulario de pago está abierto
  public formPago = { metodo: '', referencia: '' }
  public ocupado: { [id: number]: boolean } = {}
  public metodos = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro']

  private sub?: Subscription

  constructor(
    private route: ActivatedRoute,
    private service: ServiceclientesService,
    private salaService: ServicesalaService,
    private toast: ToastService
  ) { }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? ''
    // La nota flotante preselecciona a este cliente mientras estés en su expediente
    this.service.clienteContexto.next(this.id)
    this.cargarCliente()
    this.cargarNotas()
    this.cargarArchivos()
    this.cargarSalas()
    this.cargarBilletera()
    this.cargarFormularios()
    this.sub = this.service.notasActualizadas$.subscribe(() => this.cargarNotas())
  }

  ngOnDestroy(): void {
    this.service.clienteContexto.next(null)
    this.sub?.unsubscribe()
  }

  cargarCliente() {
    this.service.obtenerCliente(this.id).subscribe({
      next: (resp) => { this.cliente = resp.data; this.cargando = false },
      error: () => { this.cargando = false; this.noEncontrado = true }
    })
  }

  cargarNotas() {
    this.service.listarNotas(this.id).subscribe({
      next: (resp) => { this.notas = resp.data ?? []; this.cargandoNotas = false },
      error: () => { this.cargandoNotas = false }
    })
  }

  cargarArchivos() {
    this.service.listarArchivos(this.id).subscribe({
      next: (resp) => { this.archivos = resp.data ?? []; this.cargandoArchivos = false },
      error: () => { this.cargandoArchivos = false }
    })
  }

  cargarSalas() {
    this.salaService.listarSalas(this.id).subscribe({
      next: (resp) => { this.salas = resp.data ?? []; this.cargandoSalas = false },
      error: () => { this.cargandoSalas = false }
    })
  }

  cargarBilletera() {
    this.service.obtenerBilletera(this.id).subscribe({
      next: (resp) => {
        this.billetera = resp.data
        this.correoConfigurado = resp.correoConfigurado !== false
        this.correoFaltan = resp.correoFaltan ?? []
        this.cargandoBilletera = false
      },
      error: (err) => {
        this.cargandoBilletera = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo cargar la billetera')
      }
    })
  }

  // Elegir una reunión sin cobro precarga el concepto
  alElegirReunion() {
    const r = this.billetera?.reunionesSinCobro.find(x => x.codigo === this.formCobro.codigo_sala)
    if (r && !this.formCobro.concepto.trim()) this.formCobro.concepto = r.nombre || 'Reunión'
  }

  crearCobro() {
    const f = this.formCobro
    const monto = Number(f.monto)
    if (!monto || monto <= 0) return this.toast.error('Escribe un monto mayor que 0')
    if (!f.concepto.trim() && !f.codigo_sala) return this.toast.error('Escribe el concepto del cobro')
    if (this.creandoCobro) return
    this.creandoCobro = true
    this.service.crearCobro({
      idexpediente: this.id, concepto: f.concepto.trim(), monto,
      moneda: f.moneda.trim().toUpperCase(), codigo_sala: f.codigo_sala || undefined
    }).subscribe({
      next: () => {
        this.creandoCobro = false
        this.formCobro = { ...this.formCobro, concepto: '', monto: '', codigo_sala: '' }
        this.toast.success('Cobro creado')
        this.cargarBilletera()
      },
      error: (err) => {
        this.creandoCobro = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo crear el cobro')
      }
    })
  }

  abrirPago(c: Cobro) {
    this.cobroPagando = this.cobroPagando?.id === c.id ? null : c
    this.formPago = { metodo: '', referencia: '' }
  }

  confirmarPago(c: Cobro) {
    if (this.ocupado[c.id]) return
    this.ocupado[c.id] = true
    this.service.pagarCobro(c.id, this.formPago).subscribe({
      next: (resp) => {
        this.ocupado[c.id] = false
        this.cobroPagando = null
        this.avisoCorreo(resp.correo, 'Factura enviada al correo del cliente')
        this.cargarBilletera()
      },
      error: (err) => {
        this.ocupado[c.id] = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo registrar el pago')
      }
    })
  }

  recordar(c: Cobro) {
    if (this.ocupado[c.id]) return
    this.ocupado[c.id] = true
    this.service.recordarCobro(c.id).subscribe({
      next: () => { this.ocupado[c.id] = false; this.toast.success('Recordatorio enviado al correo del cliente'); this.cargarBilletera() },
      error: (err) => { this.ocupado[c.id] = false; this.toast.error(err.error?.message?.trim() || 'No se pudo enviar el recordatorio') }
    })
  }

  reenviar(c: Cobro) {
    if (this.ocupado[c.id]) return
    this.ocupado[c.id] = true
    this.service.reenviarFactura(c.id).subscribe({
      next: (resp) => { this.ocupado[c.id] = false; this.avisoCorreo(resp.correo, 'Factura reenviada'); this.cargarBilletera() },
      error: (err) => { this.ocupado[c.id] = false; this.toast.error(err.error?.message?.trim() || 'No se pudo reenviar la factura') }
    })
  }

  alElegirComprobante(c: Cobro, event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (file.size > 4 * 1024 * 1024) return this.toast.error('El comprobante supera el límite de 4 MB')
    if (this.ocupado[c.id]) return
    this.ocupado[c.id] = true
    this.service.subirComprobante(c.id, file).subscribe({
      next: () => { this.ocupado[c.id] = false; this.toast.success('Comprobante guardado'); this.cargarBilletera() },
      error: (err) => { this.ocupado[c.id] = false; this.toast.error(err.error?.message?.trim() || 'No se pudo subir el comprobante') }
    })
  }

  eliminarCobro(c: Cobro) {
    if (!confirm(`¿Eliminar el cobro "${c.concepto}"?`)) return
    this.service.eliminarCobro(c.id).subscribe({
      next: () => { this.toast.success('Cobro eliminado'); this.cargarBilletera() },
      error: (err) => this.toast.error(err.error?.message?.trim() || 'No se pudo eliminar el cobro')
    })
  }

  private avisoCorreo(resultado: string, textoOk: string) {
    if (resultado === 'enviado') this.toast.success(textoOk)
    else if (resultado === 'sin_correo') this.toast.error('Pago registrado, pero el cliente no tiene correo')
    else if (resultado === 'no_configurado') this.toast.error('Pago registrado. El envío de correos no está configurado en el servidor')
    else this.toast.error('Pago registrado, pero no se pudo enviar el correo')
  }

  dinero(monto: number | string, moneda: string) {
    try { return new Intl.NumberFormat('es', { style: 'currency', currency: moneda }).format(Number(monto)) }
    catch { return `${Number(monto).toFixed(2)} ${moneda}` }
  }

  get pendientes(): number { return this.billetera?.cobros.filter(c => c.estado === 'pendiente').length ?? 0 }

  // ---- Formularios ----
  private formVacio() {
    return { titulo: '', descripcion: '', campos: [] as (CampoForm & { opcionesTexto?: string })[] }
  }

  cargarFormularios() {
    this.service.listarFormularios(this.id).subscribe({
      next: (resp) => { this.formularios = resp.data ?? []; this.cargandoFormularios = false },
      error: () => { this.cargandoFormularios = false }
    })
  }

  // Un solo formulario: datos personales y, al final, fotos o documentos (se puede quitar, cambiar o agregar lo que haga falta)
  abrirConstructor() {
    const f = this.formVacio()
    f.titulo = 'Datos personales'
    f.descripcion = 'Por favor completa tus datos y sube los documentos que te pedimos. Toda la información es confidencial.'
    f.campos = [
      { tipo: 'texto', etiqueta: 'Nombre completo', requerido: true }, { tipo: 'texto', etiqueta: 'Cédula o documento', requerido: true },
      { tipo: 'fecha', etiqueta: 'Fecha de nacimiento', requerido: true }, { tipo: 'telefono', etiqueta: 'Teléfono', requerido: true },
      { tipo: 'correo', etiqueta: 'Correo electrónico', requerido: true }, { tipo: 'texto', etiqueta: 'Dirección', requerido: false },
      { tipo: 'texto', etiqueta: 'Contacto de emergencia (nombre y teléfono)', requerido: false },
      { tipo: 'archivo', etiqueta: 'Fotos o documentos', requerido: false, max: 5, ayuda: 'Puedes tomar la foto con tu celular. Acepta fotos, PDF o Word.' },
    ]
    this.nuevoForm = f
    this.constructorAbierto = true
  }

  agregarArchivo() { this.nuevoForm.campos.push({ tipo: 'archivo', etiqueta: 'Fotos o documentos', requerido: false, max: 5, ayuda: 'Puedes tomar la foto con tu celular.' }) }
  agregarCampo() { this.nuevoForm.campos.push({ tipo: 'texto', etiqueta: '', requerido: false }) }
  quitarCampo(i: number) { this.nuevoForm.campos.splice(i, 1) }
  moverCampo(i: number, d: number) {
    const c = this.nuevoForm.campos, j = i + d
    if (j < 0 || j >= c.length) return;
    [c[i], c[j]] = [c[j], c[i]]
  }
  usaOpciones(c: CampoForm) { return c.tipo === 'opcion' || c.tipo === 'casillas' }

  guardarFormulario() {
    if (this.guardandoForm) return
    const f = this.nuevoForm
    if (f.titulo.trim().length < 3) return this.toast.error('Escribe un título para el formulario')
    if (!f.campos.length) return this.toast.error('Agrega al menos una pregunta')
    const campos = f.campos.map(c => ({
      tipo: c.tipo, etiqueta: c.etiqueta.trim(), requerido: c.requerido, ayuda: c.ayuda?.trim() || undefined, max: c.tipo === 'archivo' ? c.max : undefined,
      opciones: this.usaOpciones(c) ? (c.opcionesTexto ?? '').split('\n').map(o => o.trim()).filter(Boolean) : undefined
    }))
    this.guardandoForm = true
    this.service.crearFormulario({ idexpediente: this.id, titulo: f.titulo.trim(), descripcion: f.descripcion.trim(), campos }).subscribe({
      next: () => { this.guardandoForm = false; this.constructorAbierto = false; this.toast.success('Formulario creado. Ahora genera su URL.'); this.cargarFormularios() },
      error: (err) => { this.guardandoForm = false; this.toast.error(err.error?.message?.trim() || 'No se pudo crear el formulario') }
    })
  }

  generarUrl(f: Formulario) {
    if (this.ocupadoForm[f.id]) return
    this.ocupadoForm[f.id] = true
    this.service.generarUrlFormulario(f.id, this.diasUrl).subscribe({
      next: () => { this.ocupadoForm[f.id] = false; this.toast.success('URL generada'); this.cargarFormularios() },
      error: (err) => { this.ocupadoForm[f.id] = false; this.toast.error(err.error?.message?.trim() || 'No se pudo generar la URL') }
    })
  }

  async copiarUrl(f: Formulario) {
    if (!f.url) return
    try { await navigator.clipboard.writeText(f.url); this.copiado = f.id; this.toast.success('URL copiada'); setTimeout(() => { if (this.copiado === f.id) this.copiado = null }, 2500) }
    catch { this.toast.error('No se pudo copiar la URL') }
  }

  enlaceWhatsapp(f: Formulario): string {
    const tel = (this.personas[0]?.telefono ?? '').replace(/[^\d]/g, '')
    const texto = encodeURIComponent(`Hola, por favor completa este formulario: ${f.url}`)
    return tel.length >= 7 && tel !== '' ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`
  }

  cerrarUrl(f: Formulario) {
    if (!confirm('¿Cerrar el enlace? Quien lo tenga ya no podrá abrirlo.')) return
    this.service.cerrarFormulario(f.id).subscribe({
      next: () => { this.toast.success('Enlace cerrado'); this.cargarFormularios() },
      error: (err) => this.toast.error(err.error?.message?.trim() || 'No se pudo cerrar el enlace')
    })
  }

  duplicarForm(f: Formulario) {
    this.service.duplicarFormulario(f.id).subscribe({
      next: () => { this.toast.success('Copia creada'); this.cargarFormularios() },
      error: (err) => this.toast.error(err.error?.message?.trim() || 'No se pudo duplicar')
    })
  }

  eliminarForm(f: Formulario) {
    if (!confirm(`¿Eliminar el formulario "${f.titulo}"? Las respuestas se perderán (los archivos subidos se quedan en la Biblioteca).`)) return
    this.service.eliminarFormulario(f.id).subscribe({
      next: () => { this.toast.success('Formulario eliminado'); this.cargarFormularios() },
      error: (err) => this.toast.error(err.error?.message?.trim() || 'No se pudo eliminar')
    })
  }

  verRespuestas(f: Formulario) {
    this.service.respuestasFormulario(f.id).subscribe({
      next: (resp) => { this.respuestas = resp.data; this.cargarArchivos() },
      error: (err) => this.toast.error(err.error?.message?.trim() || 'No se pudieron cargar las respuestas')
    })
  }

  valorRespuesta(v: any): string { return Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '—' : String(v) }
  etiquetaEstadoForm(e: string): string { return ({ borrador: 'Sin URL', abierto: 'Enlace activo', enviado: 'Respondido', cerrado: 'Cerrado', vencido: 'Enlace vencido' } as any)[e] ?? e }
  claseEstadoForm(e: string): string {
    return e === 'enviado' ? 'bg-emerald-100 text-emerald-800' : e === 'abierto' ? 'bg-sky-100 text-sky-800' : e === 'vencido' ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-600'
  }
  get formulariosPendientes(): number { return this.formularios.filter(f => f.estado === 'abierto').length }

  crearReunion() {
    if (this.creandoSala) return
    this.creandoSala = true
    this.salaService.crearSala(this.id, this.nombreSala.trim()).subscribe({
      next: () => {
        this.creandoSala = false
        this.nombreSala = ''
        this.toast.success('Reunión creada')
        this.cargarSalas()
      },
      error: (err) => {
        this.creandoSala = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo crear la reunión')
      }
    })
  }

  async copiarEnlace(codigo: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/sala/${codigo}`)
      this.toast.success('Enlace copiado')
    } catch {
      this.toast.error('No se pudo copiar el enlace')
    }
  }

  cambiar(t: Pestana) { this.tab = t }

  nuevaNota() { this.service.abrirNota() }

  // ---- Archivos ----
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
          this.service.subirArchivo(this.id, file).subscribe({ next: () => ok(), error: (e) => fail(e) })
        )
        this.toast.success(`"${file.name}" subido`)
      } catch (e: any) {
        this.toast.error(e?.error?.message?.trim() || `No se pudo subir "${file.name}"`)
      }
    }
    this.subiendo = false
    this.cargarArchivos()
  }

  // ---- Presentación ----
  claseEstado(e?: string | null) { return claseEstado(e) }
  etiquetaEstado(e?: string | null) { return etiquetaEstado(e) }
  detalleEstado(c: Cliente) { return detalleEstado(c) }
  claseTipo(tipo: string) { return claseTipo(tipo) }
  etiquetaTipo(tipo: string) { return etiquetaTipo(tipo) }

  iniciales(c: Cliente | null = this.cliente) {
    return c ? `${c.nombre?.[0] ?? ''}${c.apellido?.[0] ?? ''}`.toUpperCase() : ''
  }

  // Las personas del expediente: una, o las dos de la pareja
  get personas(): Cliente[] {
    const c = this.cliente
    return c ? (c.integrantes?.length ? c.integrantes : [c]) : []
  }

  nombreGrupo() { return nombreGrupo(this.personas) }


  icono(nombre: string) { return iconoArchivo(nombre) }
  tamano(bytes: number | null) { return formatoTamano(bytes) }
}
