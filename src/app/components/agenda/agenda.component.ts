import { Component, HostListener, OnInit } from '@angular/core';
import { CitaAgenda, Cobro, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { claseTipo, etiquetaTipo } from 'src/app/utils/tipos';
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
    this.pagando = false
    this.formPago = { metodo: '', referencia: '' }
    this.montoCobro = String(c.priceCents / 100)
  }

  @HostListener('document:keydown.escape')
  cerrar() { this.abierta = null }

  personas(c: CitaAgenda) {
    const lista = [
      { rol: c.partner ? 'Persona 1' : 'Cliente', f: c.patient, crm: c.clientes.find(x => x.cedula === c.patient?.idNumber) },
      ...(c.partner ? [{ rol: 'Pareja', f: c.partner as any, crm: c.clientes.find(x => x.cedula === c.partner!.idNumber) }] : []),
    ]
    return lista.map(p => ({
      rol: p.rol,
      nombre: p.crm ? `${p.crm.nombre} ${p.crm.apellido}` : p.f?.fullName ?? 'Sin nombre',
      correo: p.crm?.correo ?? p.f?.email,
      telefono: p.crm?.telefono ?? p.f?.phone,
      cedula: p.crm?.cedula ?? p.f?.idNumber,
      edad: p.crm?.edad ?? p.f?.age,
      enCrm: !!p.crm,
    }))
  }

  // Expediente al que pertenece la cita (el de la primera persona registrada en el CRM)
  expediente(c: CitaAgenda): string | null { return c.clientes[0]?.idexpediente ?? null }

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
