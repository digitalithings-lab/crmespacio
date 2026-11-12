import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ServiceadminService } from 'src/app/services/serviceadmin.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-crearcuenta',
  templateUrl: './crearcuenta.component.html',
  styleUrls: ['./crearcuenta.component.css']
})
export class CrearcuentaComponent implements OnInit {
  public nombre:any
  public apellido:any
  public correo:any
  public password:any
  public fecha:any
  public cargando = false
  constructor (private service:ServiceadminService, private toast: ToastService, private router: Router){

  }
  ngOnInit(): void {
  }



  crearcuenta(){
  if (this.cargando) return
  this.cargando = true
  const data={
    nombre:this.nombre,
    apellido:this.apellido,
    correo:this.correo,
    password:this.password,
    fecha_creacion:this.fecha
  }

  this.service.insertaradmin(data).subscribe({
    next: (resp:any) => {
      this.cargando = false
      const msj="administrador creado con exito"
      console.log(resp);
      if(resp.ok=== true){
        this.toast.success(msj);
        this.router.navigate(['/login'])
      }
    },
    error: () => { this.cargando = false }
  })
  }

}
