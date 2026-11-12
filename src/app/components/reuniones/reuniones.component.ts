import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ServicesalaService } from 'src/app/services/servicesala.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-reuniones',
  templateUrl: './reuniones.component.html',
  styleUrls: ['./reuniones.component.css']
})
export class ReunionesComponent {
  public nombre = ''
  public creando = false
  public codigoUnirse = ''
  public codigo = ''
  public copiado = false

  constructor(private service: ServicesalaService, private toast: ToastService, private router: Router) { }

  get enlace() {
    return this.codigo ? `${window.location.origin}/sala/${this.codigo}` : ''
  }

  crear() {
    if (this.creando) return
    this.creando = true
    this.service.crearSala(this.nombre.trim()).subscribe({
      next: (resp) => {
        this.creando = false
        this.codigo = resp.data.codigo
        this.copiado = false
      },
      error: (err) => {
        this.creando = false
        this.toast.error(err.error?.message?.trim() || 'No se pudo crear la reunión')
      }
    })
  }

  async copiar() {
    try {
      await navigator.clipboard.writeText(this.enlace)
      this.copiado = true
      this.toast.success('Enlace copiado')
      setTimeout(() => (this.copiado = false), 2500)
    } catch {
      this.toast.error('No se pudo copiar. Selecciona el enlace y cópialo a mano.')
    }
  }

  entrar() {
    this.router.navigate(['/sala', this.codigo])
  }

  unirse() {
    // Acepta el código solo o el enlace completo
    const texto = this.codigoUnirse.trim()
    const codigo = texto.split('/').filter(Boolean).pop()?.toLowerCase()
    if (!codigo) return
    this.router.navigate(['/sala', codigo])
  }
}
