import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit {
  public nombre = localStorage.getItem('nombre')
  public apellido = localStorage.getItem('apellido')
  public correo = localStorage.getItem('correo')
 
  constructor(){}
  
  ngOnInit(): void {
  }

  cerrarSesion() {
    ['nombre', 'apellido', 'correo'].forEach(k => localStorage.removeItem(k))
  }
}
