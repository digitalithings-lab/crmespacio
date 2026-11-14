import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CampoForm, TipoCampo } from 'src/app/services/serviceclientes.service';
import { ToastService } from 'src/app/services/toast.service';

export interface BorradorFormulario { titulo: string; descripcion: string; campos: CampoForm[] }
type CampoEditable = CampoForm & { opcionesTexto?: string }

/** Modelo con las preguntas de datos más comunes y una para subir fotos o documentos. */
export function modeloDatos(): BorradorFormulario {
  return {
    titulo: 'Datos personales',
    descripcion: 'Por favor completa tus datos y sube los documentos que te pedimos. Toda la información es confidencial.',
    campos: [
      { tipo: 'texto', etiqueta: 'Nombre completo', requerido: true }, { tipo: 'texto', etiqueta: 'Cédula o documento', requerido: true },
      { tipo: 'fecha', etiqueta: 'Fecha de nacimiento', requerido: true }, { tipo: 'telefono', etiqueta: 'Teléfono', requerido: true },
      { tipo: 'correo', etiqueta: 'Correo electrónico', requerido: true }, { tipo: 'texto', etiqueta: 'Dirección', requerido: false },
      { tipo: 'texto', etiqueta: 'Contacto de emergencia (nombre y teléfono)', requerido: false },
      { tipo: 'archivo', etiqueta: 'Fotos o documentos', requerido: false, max: 5, ayuda: 'Puedes tomar la foto con tu celular. Acepta fotos, PDF o Word.' },
    ]
  }
}

// Ventana para armar un formulario: título, mensaje y preguntas (texto, fechas, opciones, fotos o archivos…).
// La usan las plantillas generales y el expediente de cada cliente.
@Component({
  selector: 'app-constructor-formulario',
  templateUrl: './constructor-formulario.component.html',
  styleUrls: ['./constructor-formulario.component.css']
})
export class ConstructorFormularioComponent implements OnInit {
  @Input() titulo = 'Nuevo formulario'
  @Input() inicial: BorradorFormulario = modeloDatos()
  @Input() guardando = false
  @Input() textoGuardar = 'Guardar'
  @Output() guardar = new EventEmitter<BorradorFormulario>()
  @Output() cerrar = new EventEmitter<void>()

  public form: { titulo: string; descripcion: string; campos: CampoEditable[] } = { titulo: '', descripcion: '', campos: [] }
  public tiposCampo: { valor: TipoCampo; etiqueta: string }[] = [
    { valor: 'texto', etiqueta: 'Texto corto' }, { valor: 'parrafo', etiqueta: 'Texto largo' }, { valor: 'numero', etiqueta: 'Número' },
    { valor: 'fecha', etiqueta: 'Fecha' }, { valor: 'correo', etiqueta: 'Correo' }, { valor: 'telefono', etiqueta: 'Teléfono' },
    { valor: 'opcion', etiqueta: 'Elegir una opción' }, { valor: 'casillas', etiqueta: 'Varias opciones' }, { valor: 'sino', etiqueta: 'Sí / No' },
    { valor: 'archivo', etiqueta: 'Adjuntar fotos o archivos' },
  ]

  constructor(private toast: ToastService) { }

  ngOnInit(): void {
    this.form = {
      titulo: this.inicial.titulo ?? '',
      descripcion: this.inicial.descripcion ?? '',
      campos: (this.inicial.campos ?? []).map(c => ({ ...c, opcionesTexto: (c.opciones ?? []).join('\n') }))
    }
  }

  usaOpciones(c: CampoForm) { return c.tipo === 'opcion' || c.tipo === 'casillas' }
  agregarCampo() { this.form.campos.push({ tipo: 'texto', etiqueta: '', requerido: false }) }
  agregarArchivo() { this.form.campos.push({ tipo: 'archivo', etiqueta: 'Fotos o documentos', requerido: false, max: 5, ayuda: 'Puedes tomar la foto con tu celular.' }) }
  quitarCampo(i: number) { this.form.campos.splice(i, 1) }
  moverCampo(i: number, d: number) {
    const c = this.form.campos, j = i + d
    if (j < 0 || j >= c.length) return;
    [c[i], c[j]] = [c[j], c[i]]
  }

  enviar() {
    const f = this.form
    if (f.titulo.trim().length < 3) return this.toast.error('Escribe un título')
    if (!f.campos.length) return this.toast.error('Agrega al menos una pregunta')
    const campos: CampoForm[] = f.campos.map(c => ({
      tipo: c.tipo, etiqueta: c.etiqueta.trim(), requerido: c.requerido, ayuda: c.ayuda?.trim() || undefined,
      max: c.tipo === 'archivo' ? Number(c.max) || 3 : undefined,
      opciones: this.usaOpciones(c) ? (c.opcionesTexto ?? '').split('\n').map(o => o.trim()).filter(Boolean) : undefined
    }))
    this.guardar.emit({ titulo: f.titulo.trim(), descripcion: f.descripcion.trim(), campos })
  }
}
