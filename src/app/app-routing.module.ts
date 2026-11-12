import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { CrearcuentaComponent } from './components/crearcuenta/crearcuenta.component';
import { LayoutComponent } from './components/layout/layout.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ClientesComponent } from './components/clientes/clientes.component';
import { ExpedienteComponent } from './components/expediente/expediente.component';
import { ReunionesComponent } from './components/reuniones/reuniones.component';
import { SalaComponent } from './components/sala/sala.component';
import { NotasComponent } from './components/notas/notas.component';
import { BibliotecaComponent } from './components/biblioteca/biblioteca.component';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'crearcuenta', component: CrearcuentaComponent },
  // La sala es pública: quien recibe el enlace entra sin iniciar sesión
  { path: 'sala/:codigo', component: SalaComponent },
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'clientes', component: ClientesComponent },
      { path: 'clientes/:id', component: ExpedienteComponent },
      { path: 'notas', component: NotasComponent },
      { path: 'biblioteca', component: BibliotecaComponent },
      { path: 'reuniones', component: ReunionesComponent },
      {path:'crearcuenta',component:CrearcuentaComponent}
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
