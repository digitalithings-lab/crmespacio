import { Component, HostListener, OnInit } from '@angular/core';
import { CitaAgenda, Cliente, Cobro, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { claseTipo, etiquetaTipo, opcionesCliente } from 'src/app/utils/tipos';
import { ToastService } from 'src/app/services/toast.service';

interface Dia { fecha: Date; clave: string; delMes: boolean; hoy: boolean; citas: CitaAgenda[] }

const ESTADOS: { [k: string]: { texto: string; clase: string } } = {
  REQUESTED: { texto: 'Solicitada', clase: 'bg-amber-100 text-amber-800' },
  PENDING_PAYMENT: { texto: 'Pendiente de pago', clase: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { texto: 'Confirmada', clase: 'bg-emerald-100 text-emerald-800' },
  COMPLETED: { texto: 'Completada', clase: 'bg-zinc-100 text-zinc-700' },
  CANCELLED: { texto: 'Cancelada', clase: 'bg-red-100 text-red-700' },
  NO_SHOW: { texto: 'No asistió', clase: 'bg-red-100 text-red-700' },
}

// Valores provisionales con los que el CRM registra lo que la cita no traía
const esProvisional = {
  cedula: (v?: string | null) => !v || v.startsWith('PEND-'),
  correo: (v?: string | null) => !v || v.endsWith('.invalid'),
  telefono: (v?: string | null) => !v || v.trim() === '-',
  nombre: (v?: string | null) => !v || v === 'Sin nombre',
  edad: (v?: number | null) => v == null || v === 0,
}

const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

@Component({
  selector: 'app-agenda',
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.css']
})
export class AgendaComponent implements OnInit {
  public mes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  public dias: Dia[] = []
  public semanas = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  public seleccionado = clave(new Date())
  public citas: CitaAgenda[] = []
  public cargando = true
  public error = ''

  public abierta: CitaAgenda | null = null
  public correoConfigurado = true
  public pagando = false
  public formPago = { metodo: '', referencia: '' }
  public metodos = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro']
  public montoCobro = ''
  public ocupado = false
  public registrando = false

  // ---- Acciones sobre la cita ----
  public enlaceConfirmacion = ''
  public cancelando = false
  public motivoCancelacion = ''
  public editandoEnlace = false
  public enlaceEdicion = ''
  public actuando = false

  constructor(private service: ServiceclientesService, private toast: ToastService) { }

  ngOnInit(): void { this.cargar() }

  // ---- Calendario ----
  private rango(): { desde: Date; hasta: Date } {
    const primero = new Date(this.mes.getFullYear(), this.mes.getMonth(), 1)
    const lunes = (primero.getDay() + 6) % 7 // lunes = 0
    const desde = new Date(primero.getFullYear(), primero.getMonth(), 1 - lunes)
    const hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 42)
    return { desde, hasta }
  }

  cargar() {
    this.cargando = true
    this.error = ''
    const { desde, hasta } = this.rango()
    this.armarDias(desde)
    this.service.obtenerAgenda(desde, hasta).subscribe({
      next: (resp) => {
        this.citas = resp.data ?? []
        this.cargando = false
        this.armarDias(desde)
        if (this.abierta) this.abierta = this.citas.find(c => c.id === this.abierta!.id) ?? null
      },
      error: (err) => {
        this.cargando = false
        this.citas = []
        this.armarDias(desde)
        this.error = err.error?.message?.trim() || 'No se pudo cargar la agenda'
      }
    })
  }

  private armarDias(desde: Date) {
    const hoy = clave(new Date())
    const dias: Dia[] = []
    for (let i = 0; i < 42; i++) {
      const f = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i)
      const k = clave(f)
      dias.push({
        fecha: f, clave: k, delMes: f.getMonth() === this.mes.getMonth(), hoy: k === hoy,
        citas: this.citas.filter(c => clave(new Date(c.startsAt)) === k && c.status !== 'CANCELLED')
      })
    }
    this.dias = dias
  }

  mover(delta: number) {
    this.mes = new Date(this.mes.getFullYear(), this.mes.getMonth() + delta, 1)
    this.seleccionado = clave(this.mes)
    this.cargar()
  }

  hoy() {
    const h = new Date()
    this.mes = new Date(h.getFullYear(), h.getMonth(), 1)
    this.seleccionado = clave(h)
    this.cargar()
  }

  elegir(d: Dia) {
    this.seleccionado = d.clave
    if (!d.delMes) {
      this.mes = new Date(d.fecha.getFullYear(), d.fecha.getMonth(), 1)
      this.cargar()
    }
  }

  get citasDelDia(): CitaAgenda[] {
    return this.citas.filter(c => clave(new Date(c.startsAt)) === this.seleccionado)
  }

  get fechaSeleccionada(): Date {
    const [y, m, d] = this.seleccionado.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  // ---- Detalle de la cita ----
  abrir(c: CitaAgenda) {
    this.abierta = c
    this.cancelando = false
    this.editandoEnlace = false
    this.enlaceConfirmacion = ''
    this.motivoCancelacion = ''
    this.pagando = false
    this.formPago = { metodo: '', referencia: '' }
    this.montoCobro = String(c.priceCents / 100)
  }

  @HostListener('document:keydown.escape')
  cerrar() { this.abierta = null; if (!this.creandoCita) this.nueva = false }

  // Se calcula una vez por cita (la cita se reemplaza al recargar la agenda): así la lista es estable entre ciclos
  private cachePersonas = new WeakMap<CitaAgenda, any[]>()

  personas(c: CitaAgenda) {
    const guardada = this.cachePersonas.get(c)
    if (guardada) return guardada
    const resultado = this.calcularPersonas(c)
    this.cachePersonas.set(c, resultado)
    return resultado
  }

  private calcularPersonas(c: CitaAgenda) {
    const lista = [
      { rol: 1, etiqueta: c.partner ? 'Persona 1' : 'Cliente', f: c.patient as any, crm: c.cliente1 },
      ...(c.partner ? [{ rol: 2, etiqueta: 'Pareja', f: c.partner as any, crm: c.cliente2 }] : []),
    ]
    return lista.map(p => {
      const crm = p.crm
      const cedula = crm ? (esProvisional.cedula(crm.cedula) ? '' : crm.cedula) : p.f?.idNumber ?? ''
      const correo = crm ? (esProvisional.correo(crm.correo) ? '' : crm.correo) : p.f?.email ?? ''
      const telefono = crm ? (esProvisional.telefono(crm.telefono) ? '' : crm.telefono) : p.f?.phone ?? ''
      const nombre = crm ? (esProvisional.nombre(crm.nombre) ? '' : `${crm.nombre} ${crm.apellido === '-' ? '' : crm.apellido}`.trim()) : p.f?.fullName ?? ''
      const edad = crm ? (esProvisional.edad(crm.edad) ? null : crm.edad) : p.f?.age ?? null
      const faltan = [!nombre && 'nombre', !cedula && 'cédula', !correo && 'correo', !telefono && 'teléfono', edad == null && 'edad'].filter(Boolean) as string[]
      return { rol: p.rol, etiqueta: p.etiqueta, crm, nombre, cedula, correo, telefono, edad, faltan, enCrm: !!crm }
    })
  }

  // personas() devuelve objetos nuevos en cada ciclo; sin esto Angular recrearía el formulario mientras se escribe
  porRol = (_: number, p: { rol: number }) => p.rol

  // ¿Alguna persona de la cita tiene datos por completar?
  incompleta(c: CitaAgenda): boolean { return this.personas(c).some(p => p.faltan.length > 0) }

  // ---- Editar los datos de una persona ya registrada ----
  public editando: number | null = null
  public formEdicion = { nombre: '', apellido: '', correo: '', cedula: '', telefono: '', edad: '' as string | number }
  public guardando = false

  editar(p: { rol: number; crm: any; nombre: string; cedula: string; correo: string; telefono: string; edad: number | null }) {
    if (!p.crm) return
    this.editando = p.rol
    this.formEdicion = {
      nombre: esProvisional.nombre(p.crm.nombre) ? '' : p.crm.nombre,
      apellido: p.crm.apellido === '-' ? '' : p.crm.apellido,
      correo: p.correo, cedula: p.cedula, telefono: p.telefono, edad: p.edad ?? ''
    }
  }

  guardarEdicion(p: { crm: any }) {
    if (this.guardando || !p.crm) return
    const f = this.formEdicion
    this.guardando = true
    this.service.editarCliente(p.crm.idexpediente, {
      nombre: f.nombre, apellido: f.apellido, correo: f.correo, cedula: f.cedula, telefono: f.telefono,
      edad: f.edad === '' ? 0 : Number(f.edad)
    }).subscribe({
      next: () => { this.guardando = false; this.editando = null; this.toast.success('Datos guardados'); this.cargar() },
      error: (err) => { this.guardando = false; this.toast.error(err.error?.message?.trim() || 'No se pudieron guardar los datos') }
    })
  }

  // ---- Crear una cita a mano ----
  public nueva = false
  public creandoCita = false
  public clientesLista: Cliente[] = []
  public cargandoSlots = false
  public slotsDia: { startsAt: string; label: string }[] = []
  public formNueva = this.formVacio()

  private formVacio() {
    const persona = () => ({ nombre: '', cedula: '', correo: '', telefono: '', nacimiento: '' })
    return {
      modo: 'existente' as 'existente' | 'nuevo', idexpediente: null as string | null, tipo: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COUPLE' | 'CHILD',
      p1: persona(), p2: persona(), fecha: '', hora: '', fuera: false, slot: '' as string,
      modalidad: 'VIDEO' as 'VIDEO' | 'IN_PERSON', motivo: '', confirmar: true, enlace: ''
    }
  }

  get opcionesClientes() { return opcionesCliente(this.clientesLista) }

  abrirNueva() {
    this.formNueva = this.formVacio()
    this.formNueva.fecha = this.seleccionado
    this.slotsDia = []
    this.nueva = true
    this.cargarSlots()
    if (!this.clientesLista.length) {
      this.service.listarClientes().subscribe({ next: (r) => { this.clientesLista = r.data ?? [] }, error: () => { } })
    }
  }

  cambiarModo(modo: 'existente' | 'nuevo') {
    const f = this.formNueva
    f.modo = modo
    if (modo === 'nuevo') { f.idexpediente = null }
  }

  elegirCliente(idexpediente: string | null) {
    const f = this.formNueva
    f.idexpediente = idexpediente
    if (!idexpediente) return
    this.service.obtenerCliente(idexpediente).subscribe({
      next: (r) => {
        const c: Cliente = r.data
        const gente = c.integrantes?.length ? c.integrantes : [c]
        const limpio = (p: Cliente) => ({
          nombre: `${p.nombre} ${p.apellido === '-' ? '' : p.apellido}`.trim(),
          cedula: p.cedula?.startsWith('PEND-') ? '' : (p.cedula ?? ''),
          correo: p.correo?.endsWith('.invalid') ? '' : (p.correo ?? ''),
          telefono: (p.telefono ?? '').trim() === '-' ? '' : (p.telefono ?? ''),
          nacimiento: ''
        })
        f.p1 = limpio(gente[0])
        if (gente[1]) f.p2 = limpio(gente[1])
        const t = (c.tipo ?? '').toLowerCase()
        f.tipo = gente.length > 1 || t === 'pareja' ? 'COUPLE' : t.startsWith('ni') ? 'CHILD' : 'INDIVIDUAL'
      },
      error: () => this.toast.error('No se pudieron cargar los datos del cliente')
    })
  }

  cargarSlots() {
    const f = this.formNueva
    f.slot = ''
    if (!f.fecha || f.fuera) { this.slotsDia = []; return }
    this.cargandoSlots = true
    this.service.horariosLibres(f.fecha, 1).subscribe({
      next: (r) => { this.slotsDia = r.data?.days?.[0]?.slots ?? []; this.cargandoSlots = false },
      error: (err) => { this.slotsDia = []; this.cargandoSlots = false; this.toast.error(err.error?.message?.trim() || 'No se pudieron cargar las horas libres') }
    })
  }

  crearCita() {
    if (this.creandoCita) return
    const f = this.formNueva
    if (f.modo === 'existente' && !f.idexpediente) return this.toast.error('Elige un cliente o cambia a "Cliente nuevo"')
    if (!f.p1.nombre.trim()) return this.toast.error('Escribe el nombre del cliente')
    if (f.tipo === 'COUPLE' && !f.p2.nombre.trim()) return this.toast.error('Escribe el nombre de la pareja')
    let inicia = ''
    if (f.fuera) {
      if (!f.fecha || !f.hora) return this.toast.error('Elige la fecha y la hora de la cita')
      inicia = new Date(`${f.fecha}T${f.hora}`).toISOString()
    } else {
      if (!f.slot) return this.toast.error('Elige una hora libre o marca "Fuera del horario de atención"')
      inicia = f.slot
    }
    this.creandoCita = true
    this.service.crearCita({
      inicia, fueraDeHorario: f.fuera, modalidad: f.modalidad, tipo: f.tipo, motivo: f.motivo.trim() || undefined,
      ...f.p1, pareja: f.tipo === 'COUPLE' ? f.p2 : undefined,
      confirmar: f.confirmar, meetingUrl: f.confirmar && f.modalidad === 'VIDEO' ? f.enlace.trim() || undefined : undefined
    }).subscribe({
      next: (resp) => {
        this.creandoCita = false
        this.nueva = false
        this.toast.success(f.confirmar ? 'Cita creada y confirmada' : 'Cita creada')
        if (resp.cliente === 'error') this.toast.error('No se pudo registrar al cliente. Abre la cita y usa "Reintentar registro".')
        this.avisoCorreoCita(resp.correo)
        const d = new Date(inicia)
        this.mes = new Date(d.getFullYear(), d.getMonth(), 1)
        this.seleccionado = clave(d)
        this.cargar()
      },
      error: (err) => { this.creandoCita = false; this.toast.error(err.error?.message?.trim() || 'No se pudo crear la cita') }
    })
  }

  // ---- Confirmar, cancelar y cerrar citas ----
  yaEmpezo(c: CitaAgenda): boolean { return new Date(c.startsAt) <= new Date() }

  private llamar(c: CitaAgenda, cuerpo: any, exito: string) {
    if (this.actuando) return
    this.actuando = true
    this.service.actuarCita(c.id, cuerpo).subscribe({
      next: (resp) => {
        this.actuando = false
        this.cancelando = false
        this.editandoEnlace = false
        this.motivoCancelacion = ''
        this.toast.success(exito)
        if (resp.cliente === 'error') this.toast.error('No se pudo registrar al cliente. Usa "Reintentar registro".')
        else if (resp.cobro === 'creado') this.toast.success('Cobro de la cita creado en la billetera')
        this.avisoCorreoCita(resp.correo)
        this.cargar()
      },
      error: (err) => { this.actuando = false; this.toast.error(err.error?.message?.trim() || 'No se pudo completar la acción') }
    })
  }

  private avisoCorreoCita(resultado?: string) {
    if (resultado === 'enviado') this.toast.success('Correo enviado a la persona')
    else if (resultado === 'sin_correo') this.toast.error('La persona no tiene un correo válido: no se envió el correo')
    else if (resultado === 'no_configurado') this.toast.error('El envío de correos no está configurado en el servidor')
    else if (resultado === 'error') this.toast.error('No se pudo enviar el correo')
  }

  confirmarCita(c: CitaAgenda) {
    this.llamar(c, { action: 'confirm', meetingUrl: this.enlaceConfirmacion.trim() || undefined }, 'Cita confirmada')
    this.enlaceConfirmacion = ''
  }
  cancelarCita(c: CitaAgenda) {
    if (this.motivoCancelacion.trim().length < 5) return this.toast.error('Escribe el motivo de la cancelación (al menos 5 caracteres)')
    this.llamar(c, { action: 'cancel', cancelReason: this.motivoCancelacion.trim() }, 'Cita cancelada')
  }
  cerrarCita(c: CitaAgenda, accion: 'complete' | 'no_show') {
    this.llamar(c, { action: accion }, accion === 'complete' ? 'Cita completada' : 'Marcada como no asistió')
  }
  reenviarConfirmacion(c: CitaAgenda) { this.llamar(c, { action: 'resend' }, 'Confirmación reenviada') }
  reintentarRegistro(c: CitaAgenda) { this.llamar(c, { action: 'sync' }, 'Cliente y cobro listos') }
  abrirEdicionEnlace(c: CitaAgenda) { this.editandoEnlace = true; this.enlaceEdicion = c.meetingUrl ?? '' }
  guardarEnlace(c: CitaAgenda) { this.llamar(c, { action: 'update', meetingUrl: this.enlaceEdicion.trim() }, 'Enlace guardado') }

  // ---- Registrar en el CRM a quien aún no está ----
  faltanEnCrm(c: CitaAgenda): boolean { return this.personas(c).some(p => !p.enCrm) }

  // Registra a quien aún no está. Lo que falte queda como dato provisional para completarlo después.
  registrar(c: CitaAgenda) {
    if (this.registrando) return
    this.registrando = true
    const personas = this.personas(c).map(p => ({
      rol: p.rol, nombre: p.nombre, cedula: p.cedula, correo: p.correo, telefono: p.telefono, edad: p.edad
    }))
    this.service.registrarCita({ cita_ref: c.id, tipo: this.tipo(c), idgrupo: c.crmGroupId || undefined, personas }).subscribe({
      next: () => {
        this.registrando = false
        const faltan = personas.some(p => !p.nombre || !p.cedula || !p.correo || !p.telefono || p.edad == null)
        this.toast.success(faltan ? 'Registrado. Completa los datos que faltan' : 'Cliente registrado en el CRM')
        this.cargar()
      },
      error: (err) => { this.registrando = false; this.toast.error(err.error?.message?.trim() || 'No se pudo registrar en el CRM') }
    })
  }

  // Expediente al que pertenece la cita (el de la primera persona registrada en el CRM)
  expediente(c: CitaAgenda): string | null { return (c.cliente1 ?? c.cliente2)?.idexpediente ?? null }

  nombreCita(c: CitaAgenda): string {
    const a = c.patient?.fullName?.split(' ')[0]
    const b = c.partner?.fullName?.split(' ')[0]
    return (b ? `${a} y ${b}` : c.patient?.fullName) ?? 'Sin nombre'
  }

  estado(c: CitaAgenda) { return ESTADOS[c.status] ?? { texto: c.status, clase: 'bg-zinc-100 text-zinc-700' } }
  tipo(c: CitaAgenda) { return c.clientType === 'COUPLE' ? 'pareja' : c.clientType === 'CHILD' ? 'niños/adolescentes' : 'individual' }
  claseTipo(t: string) { return claseTipo(t) }
  etiquetaTipo(t: string) { return etiquetaTipo(t) }

  dinero(monto: number | string, moneda: string) {
    try { return new Intl.NumberFormat('es', { style: 'currency', currency: moneda }).format(Number(monto)) }
    catch { return `${Number(monto).toFixed(2)} ${moneda}` }
  }

  // ---- Billetera de la cita ----
  crearCobro(c: CitaAgenda) {
    const exp = this.expediente(c)
    const monto = Number(this.montoCobro)
    if (!exp) return this.toast.error('Este cliente aún no está en el CRM')
    if (!monto || monto <= 0) return this.toast.error('Escribe un monto mayor que 0')
    if (this.ocupado) return
    this.ocupado = true
    const fecha = new Date(c.startsAt).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })
    this.service.crearCobro({ idexpediente: exp, concepto: `Sesión de terapia · ${fecha}`, monto, moneda: c.currency, cita_ref: c.id }).subscribe({
      next: () => { this.ocupado = false; this.toast.success('Cobro creado'); this.cargar() },
      error: (err) => { this.ocupado = false; this.toast.error(err.error?.message?.trim() || 'No se pudo crear el cobro') }
    })
  }

  confirmarPago(co: Cobro) {
    if (this.ocupado) return
    this.ocupado = true
    this.service.pagarCobro(co.id, this.formPago).subscribe({
      next: (resp) => {
        this.ocupado = false
        this.pagando = false
        this.avisoCorreo(resp.correo, 'Factura enviada al correo del cliente')
        this.cargar()
      },
      error: (err) => { this.ocupado = false; this.toast.error(err.error?.message?.trim() || 'No se pudo registrar el pago') }
    })
  }

  recordar(co: Cobro) {
    if (this.ocupado) return
    this.ocupado = true
    this.service.recordarCobro(co.id).subscribe({
      next: () => { this.ocupado = false; this.toast.success('Recordatorio enviado al correo del cliente'); this.cargar() },
      error: (err) => { this.ocupado = false; this.toast.error(err.error?.message?.trim() || 'No se pudo enviar el recordatorio') }
    })
  }

  reenviar(co: Cobro) {
    if (this.ocupado) return
    this.ocupado = true
    this.service.reenviarFactura(co.id).subscribe({
      next: (resp) => { this.ocupado = false; this.avisoCorreo(resp.correo, 'Factura reenviada'); this.cargar() },
      error: (err) => { this.ocupado = false; this.toast.error(err.error?.message?.trim() || 'No se pudo reenviar la factura') }
    })
  }

  private avisoCorreo(resultado: string, textoOk: string) {
    if (resultado === 'enviado') this.toast.success(textoOk)
    else if (resultado === 'sin_correo') this.toast.error('Pago registrado, pero el cliente no tiene correo')
    else if (resultado === 'no_configurado') this.toast.error('Pago registrado. El envío de correos no está configurado en el servidor')
    else this.toast.error('Pago registrado, pero no se pudo enviar el correo')
  }
}
