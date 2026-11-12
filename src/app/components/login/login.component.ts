import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ServiceadminService } from 'src/app/services/serviceadmin.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  public correo:any
  public password:any
  public data:any
  public cargando = false
  constructor(private service:ServiceadminService,private route: Router,private toast: ToastService){

  }
  ngOnInit(): void {
  }


  login(){
  if (this.cargando) return
  this.cargando = true
  const data={
    correo:this.correo,
    password:this.password
  }

  this.service.login(data).subscribe({
    next: (resp:any) => {
      this.cargando = false
      console.log(resp);
      const data = resp['data']
      if(resp.ok === true){
        this.route.navigate(['/dashboard'])
        localStorage.setItem('nombre',data.nombre)
        localStorage.setItem('apellido',data.apellido)
        localStorage.setItem('correo',data.correo)
      }
    },
    error: (err) => {
      this.cargando = false
      // Sin respuesta del servidor (status 0) o el mensaje que envía el backend
      this.toast.error(err.status === 0
        ? 'No se pudo conectar con el servidor'
        : (err.error?.message?.trim() || 'No se pudo iniciar sesión'))
    }
  })
  }

}
