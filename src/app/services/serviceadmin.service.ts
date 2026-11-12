import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
const api = environment.apiUrl

@Injectable({
  providedIn: 'root'
})
export class ServiceadminService {

  constructor(private http: HttpClient) { }


  insertaradmin(data: any): Observable<any> {
    return this.http.post<any>(`${api}/crearadmin`, data);
  }

  login(data: any): Observable<any> {
    return this.http.post<any>(`${api}/login`, data);
  }
}
