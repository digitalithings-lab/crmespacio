import { Component, HostListener, OnInit } from '@angular/core';

interface Recordatorio { id: string; texto: string; hecho: boolean; creado: number; hechoEn?: number }

const CLAVE = 'crm_recordatorios'
const HORAS_HECHOS = 24 // un recordatorio marcado como hecho desaparece solo pasadas 24 horas

// Burbuja flotante del dashboard para anotar recordatorios rápidos.
// Se guardan solo en este navegador (temporal): no van al servidor ni se ven en otros dispositivos.
@Component({
  selector: 'app-recordatorios',
  templateUrl: './recordatorios.component.html',
  styleUrls: ['./recordatorios.component.css']
})
export class RecordatoriosComponent implements OnInit {
  public abierto = false
  public texto = ''
  public lista: Recordatorio[] = []

  ngOnInit(): void { this.cargar() }

  private cargar() {
    let guardados: Recordatorio[] = []
    try {
      const crudo = localStorage.getItem(CLAVE)
      if (crudo) guardados = JSON.parse(crudo)
    } catch { /* sin almacenamiento disponible: se trabaja solo en memoria */ }
    const ahora = Date.now()
    this.lista = (Array.isArray(guardados) ? guardados : [])
      .filter(r => r && typeof r.texto === 'string' && !(r.hecho && r.hechoEn && ahora - r.hechoEn > HORAS_HECHOS * 3_600_000))
    this.guardar()
  }

  private guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(this.lista)) } catch { /* se mantiene en memoria */ }
  }

  get pendientes(): number { return this.lista.filter(r => !r.hecho).length }
  get hayHechos(): boolean { return this.lista.some(r => r.hecho) }

  alternar() { this.abierto = !this.abierto }

  @HostListener('document:keydown.escape')
  cerrar() { this.abierto = false }

  agregar() {
    const t = this.texto.trim().slice(0, 300)
    if (!t) return
    this.lista = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, texto: t, hecho: false, creado: Date.now() }, ...this.lista]
    this.texto = ''
    this.guardar()
  }

  marcar(r: Recordatorio) {
    r.hecho = !r.hecho
    r.hechoEn = r.hecho ? Date.now() : undefined
    this.guardar()
  }

  quitar(r: Recordatorio) {
    this.lista = this.lista.filter(x => x.id !== r.id)
    this.guardar()
  }

  borrarHechos() {
    this.lista = this.lista.filter(r => !r.hecho)
    this.guardar()
  }

  borrarTodos() {
    if (!this.lista.length || !confirm('¿Borrar todos los recordatorios?')) return
    this.lista = []
    this.guardar()
  }

  trackId = (_: number, r: Recordatorio) => r.id
}
