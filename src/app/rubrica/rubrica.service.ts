import {inject, Injectable} from '@angular/core';
// HttpClient serve per fare richieste di rete (GET, POST, PUT, DELETE) verso il server
import {HttpClient} from '@angular/common/http';
import {Auth} from '../auth/auth';
import {Cliente} from './rubrica'; // Importa l'interfaccia (la "forma" dei dati) da rubrica.ts

/**
 * SERVIZIO RUBRICA
 * providedIn: 'root' significa che Angular crea una sola istanza globale di questo servizio
 * e la rende disponibile a tutta l'applicazione.
 */
@Injectable({
  providedIn: 'root'
})
export class RubricaService {

  // Strumenti iniettati
  private http = inject(HttpClient);
  private authService = inject(Auth);

  // L'indirizzo base del backend Spring Boot per la gestione dei clienti
  private apiUrl = 'http://localhost:8080/api/clienti';

  /**
   * RECUPERA I CLIENTI (READ - Metodo HTTP GET)
   */
  getClientiDalDb() {
    return this.http.get<Cliente[]>(this.apiUrl);
  }

  /**
   * SALVA O AGGIORNA UN CLIENTE (CREATE / UPDATE)
   */
  salvaClienteNelDb(cliente: Cliente) {
    if (cliente.id) {
      // PUT senza query param utenteId
      return this.http.put<Cliente>(`${this.apiUrl}/${cliente.id}`, cliente);
    } else {
      // POST senza query param utenteId
      return this.http.post<Cliente>(this.apiUrl, cliente);
    }
  }

  /**
   * ELIMINA UN CLIENTE (DELETE - Metodo HTTP DELETE)
   */
  eliminaClienteDalDb(id: number | string) {
    // DELETE senza query param utenteId
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
