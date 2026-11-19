import { Component, Input } from '@angular/core';
import { Nota, ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { ToastService } from 'src/app/services/toast.service';

const aInputLocal = (valor?: string | Date): string => {
  const d = valor ? new Date(valor) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

@Component({
  selector: 'app-tarjeta-nota',
  templateUrl: './tarjeta-nota.component.html',
})
export class TarjetaNotaComponent {
  @Input() nota!: Nota
  @Input() mostrarCliente = false
  @Input() compacta = false

  public editando = false
  public confirmandoEliminar = false
  public guardando = false
  public textoEdit = ''
  public fechaEdit = ''

  constructor(private service: ServiceclientesService, private toast: ToastService) { }

  iniciarEdicion() {
    this.confirmandoEliminar = false
    this.textoEdit = this.nota.texto
    this.fechaEdit = aInputLocal(this.nota.fecha_creacion)
    this.editando = true
  }

  cancelarEdicion() {
    if (this.guardando) return
    this.editando = false
  }

  guardarEdicion() {
    if (this.guardando) return
    const texto = this.textoEdit.trim()
    if (!texto) {
      this.toast.error('La nota no puede quedar vacía')
      return
    }
    const fecha = this.fechaEdit ? new Date(this.fechaEdit) : null
    if (fecha && Number.isNaN(fecha.getTime())) {
      this.toast.error('La fecha de la nota no es válida')
      return
    }

    this.guardando = true
    this.service.editarNota(this.nota.idnota, {
      texto,
      ...(fecha ? { fecha: fecha.toISOString() } : {})
    }).subscribe({
      next: () => {
        this.guardando = false
        this.editando = false
        this.toast.success('Nota actualizada')
      },
      error: (err) => {
        this.guardando = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo actualizar la nota')
      }
    })
  }

  pedirEliminar() {
    this.editando = false
    this.confirmandoEliminar = true
  }

  cancelarEliminar() {
    if (this.guardando) return
    this.confirmandoEliminar = false
  }

  eliminar() {
    if (this.guardando) return
    this.guardando = true
    this.service.eliminarNota(this.nota.idnota).subscribe({
      next: () => {
        this.guardando = false
        this.confirmandoEliminar = false
        this.toast.success('Nota eliminada')
      },
      error: (err) => {
        this.guardando = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo eliminar la nota')
      }
    })
  }
}
