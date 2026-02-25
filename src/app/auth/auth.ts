import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/auth';

  login(dati: any) {
    return this.http.post(`${this.apiUrl}/login`, dati);
  }

  register(dati: any) {
    return this.http.post(`${this.apiUrl}/register`, dati);
  }

  updateProfilo(id: number, dati: any) {
    return this.http.put(`${this.apiUrl}/update/${id}`, dati);
  }

  setUtenteLoggato(utente: any) {
    // Salva l'utente nella memoria del browser
    localStorage.setItem('utente', JSON.stringify(utente));
  }

  getUtenteLoggato() {
    // Recupera l'utente. Se non c'è, restituisce null
    const utenteString = localStorage.getItem('utente');
    return utenteString ? JSON.parse(utenteString) : null;
  }

  logout() {
    // Cancella l'utente dalla memoria
    localStorage.removeItem('utente');
  }
}
