import { LOCALE_ID, NgModule } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CrearcuentaComponent } from './components/crearcuenta/crearcuenta.component';
import { LayoutComponent } from './components/layout/layout.component';
import { ClientesComponent } from './components/clientes/clientes.component';
import { NotasComponent } from './components/notas/notas.component';
import { BibliotecaComponent } from './components/biblioteca/biblioteca.component';
import { FormsModule } from '@angular/forms';
import { ToastComponent } from './components/toast/toast.component';
import { ExpedienteComponent } from './components/expediente/expediente.component';
import { NotaFlotanteComponent } from './components/nota-flotante/nota-flotante.component';
import { ReunionesComponent } from './components/reuniones/reuniones.component';
import { AgendaComponent } from './components/agenda/agenda.component';
import { SalaComponent } from './components/sala/sala.component';

registerLocaleData(localeEs)

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    DashboardComponent,
    CrearcuentaComponent,
    LayoutComponent,
    ClientesComponent,
    NotasComponent,
    BibliotecaComponent,
    ToastComponent,
    ExpedienteComponent,
    NotaFlotanteComponent,
    ReunionesComponent,
    SalaComponent,
    AgendaComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule


  ],
  providers: [{ provide: LOCALE_ID, useValue: 'es' }],
  bootstrap: [AppComponent]
})
export class AppModule { }
