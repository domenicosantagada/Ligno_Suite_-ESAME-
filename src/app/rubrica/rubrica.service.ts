import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Auth} from '../auth/auth';
import {Cliente} from './rubrica'; // Importa l'interfaccia da rubrica.ts

@Injectable({
  providedIn: 'root'
})
export class RubricaService {
  private http = inject(HttpClient);
  private authService = inject(Auth);
  private apiUrl = 'http://localhost:8080/api/clienti';

  getClientiDalDb() {
    const utenteLoggato = this.authService.getUtenteLoggato();
    const utenteId = utenteLoggato ? utenteLoggato.id : 0;
    return this.http.get<Cliente[]>(`${this.apiUrl}?utenteId=${utenteId}`);
  }

  salvaClienteNelDb(cliente: Cliente) {
    const utenteLoggato = this.authService.getUtenteLoggato();
    if (utenteLoggato) {
      cliente.utenteId = utenteLoggato.id; // Assegna il cliente all'utente loggato!
    }

    if (cliente.id) {
      // Se ha un ID, è una MODIFICA (PUT)
      return this.http.put<Cliente>(`${this.apiUrl}/${cliente.id}`, cliente);
    } else {
      // Se non ha ID, è NUOVO (POST)
      return this.http.post<Cliente>(this.apiUrl, cliente);
    }
  }

  eliminaClienteDalDb(id: number | string) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
