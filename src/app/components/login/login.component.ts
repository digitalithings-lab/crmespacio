import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ServiceadminService } from 'src/app/services/serviceadmin.service';

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
  constructor(private service:ServiceadminService,private route: Router){

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
    error: () => { this.cargando = false }
  })
  }

}
