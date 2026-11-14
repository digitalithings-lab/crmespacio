import { Component, OnInit } from '@angular/core';
import { ServiceclientesService } from 'src/app/services/serviceclientes.service';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit {
  public nombre = localStorage.getItem('nombre')
  public apellido = localStorage.getItem('apellido')
  public correo = localStorage.getItem('correo')
 
  public mostrarRecordatorios$ = this.clientes.mostrarRecordatorios

  constructor(private clientes: ServiceclientesService) {}
  
  ngOnInit(): void {
  }

  cerrarSesion() {
    ['nombre', 'apellido', 'correo'].forEach(k => localStorage.removeItem(k))
  }
}
