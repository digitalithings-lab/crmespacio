import { Component, OnInit } from '@angular/core';
import { ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { ToastService } from 'src/app/services/toast.service';

interface Rango { inicio: string; fin: string }
interface DiaSemana { dia: number; nombre: string; rangos: Rango[] }

const DIAS: { dia: number; nombre: string }[] = [
  { dia: 1, nombre: 'Lunes' }, { dia: 2, nombre: 'Martes' }, { dia: 3, nombre: 'Miércoles' }, { dia: 4, nombre: 'Jueves' },
  { dia: 5, nombre: 'Viernes' }, { dia: 6, nombre: 'Sábado' }, { dia: 0, nombre: 'Domingo' },
]

const aMinutos = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const aHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

@Component({
  selector: 'app-agenda-ajustes',
  templateUrl: './agenda-ajustes.component.html',
  styleUrls: ['./agenda-ajustes.component.css']
})
export class AgendaAjustesComponent implements OnInit {
  public cargando = true
  public error = ''
  public config: any = {}
  public semana: DiaSemana[] = []
  public bloqueos: any[] = []

  public guardandoConfig = false
  public guardandoHorarios = false
  public creandoBloqueo = false
  public bloqueo = { inicia: '', termina: '', motivo: '' }

  constructor(private service: ServiceclientesService, private toast: ToastService) { }

  ngOnInit(): void { this.cargar() }

  private aplicar(data: any) {
    this.config = { ...data.config }
    this.bloqueos = data.bloqueos ?? []
    this.semana = DIAS.map(d => ({
      ...d,
      rangos: (data.reglas as any[]).filter(r => r.dia === d.dia).map(r => ({ inicio: aHora(r.inicio_min), fin: aHora(r.fin_min) }))
    }))
  }

  cargar() {
    this.service.obtenerAjustes().subscribe({
      next: (resp) => { this.aplicar(resp.data); this.cargando = false },
      error: (err) => { this.cargando = false; this.error = err.error?.message?.trim() || 'No se pudieron cargar los ajustes' }
    })
  }

  guardarConfig() {
    if (this.guardandoConfig) return
    this.guardandoConfig = true
    const c = this.config
    this.service.guardarConfigAgenda({
      nombre: c.nombre, especialidades: c.especialidades, minutos_sesion: Number(c.minutos_sesion), descanso_min: Number(c.descanso_min),
      precio: Number(c.precio), moneda: String(c.moneda ?? '').toUpperCase(), zona_horaria: c.zona_horaria,
      enlace_videollamada: c.enlace_videollamada ?? '', agenda_publica: !!c.agenda_publica
    }).subscribe({
      next: (resp) => { this.guardandoConfig = false; this.aplicar(resp.data); this.toast.success('Ajustes guardados') },
      error: (err) => { this.guardandoConfig = false; this.toast.error(err.error?.message?.trim() || 'No se pudieron guardar los ajustes') }
    })
  }

  agregarRango(d: DiaSemana) { d.rangos.push({ inicio: '10:00', fin: '18:00' }) }
  quitarRango(d: DiaSemana, i: number) { d.rangos.splice(i, 1) }

  guardarHorarios() {
    if (this.guardandoHorarios) return
    const reglas: any[] = []
    for (const d of this.semana) {
      for (const r of d.rangos) {
        if (!r.inicio || !r.fin) return this.toast.error(`Completa las horas del ${d.nombre}`)
        reglas.push({ dia: d.dia, inicio_min: aMinutos(r.inicio), fin_min: aMinutos(r.fin) })
      }
    }
    this.guardandoHorarios = true
    this.service.guardarHorarios(reglas).subscribe({
      next: (resp) => { this.guardandoHorarios = false; this.aplicar(resp.data); this.toast.success('Horario semanal guardado') },
      error: (err) => { this.guardandoHorarios = false; this.toast.error(err.error?.message?.trim() || 'No se pudo guardar el horario') }
    })
  }

  crearBloqueo() {
    const b = this.bloqueo
    if (!b.inicia || !b.termina) return this.toast.error('Elige cuándo empieza y cuándo termina el bloqueo')
    if (this.creandoBloqueo) return
    this.creandoBloqueo = true
    this.service.crearBloqueo({ inicia: new Date(b.inicia).toISOString(), termina: new Date(b.termina).toISOString(), motivo: b.motivo }).subscribe({
      next: (resp) => { this.creandoBloqueo = false; this.bloqueo = { inicia: '', termina: '', motivo: '' }; this.aplicar(resp.data); this.toast.success('Bloqueo creado') },
      error: (err) => { this.creandoBloqueo = false; this.toast.error(err.error?.message?.trim() || 'No se pudo crear el bloqueo') }
    })
  }

  quitarBloqueo(id: string | number) {
    this.service.quitarBloqueo(id).subscribe({
      next: (resp) => { this.aplicar(resp.data); this.toast.success('Bloqueo quitado') },
      error: (err) => this.toast.error(err.error?.message?.trim() || 'No se pudo quitar el bloqueo')
    })
  }
}
