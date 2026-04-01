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
    // 1. Capiamo chi sta usando l'app
    const utenteLoggato = this.authService.getUtenteLoggato();
    // recuperiamo l'ID dell'utente loggato se esiste altrimenti 0
    const utenteId = utenteLoggato ? utenteLoggato.id : 0;

    // 2. Chiediamo al database SOLO i clienti che appartengono a questo utente
    // Passiamo l'id tramite Query Parameter (?utenteId=...)
    return this.http.get<Cliente[]>(`${this.apiUrl}?utenteId=${utenteId}`);
  }

  /**
   * SALVA O AGGIORNA UN CLIENTE (CREATE / UPDATE)
   */
  salvaClienteNelDb(cliente: Cliente) {
    const utenteLoggato = this.authService.getUtenteLoggato();
    const utenteId = utenteLoggato ? utenteLoggato.id : 0;
    
    if (cliente.id) {
      // PUT con query param
      return this.http.put<Cliente>(`${this.apiUrl}/${cliente.id}?utenteId=${utenteId}`, cliente);
    } else {
      // POST con query param
      return this.http.post<Cliente>(`${this.apiUrl}?utenteId=${utenteId}`, cliente);
    }
  }

  /**
   * ELIMINA UN CLIENTE (DELETE - Metodo HTTP DELETE)
   */
  eliminaClienteDalDb(id: number | string) {
    // 1. Recupera l'utente loggato per sapere il suo ID
    const utenteLoggato = this.authService.getUtenteLoggato();
    const utenteId = utenteLoggato ? utenteLoggato.id : 0;

    // 2. Aggiungi l'utenteId come parametro nella query string dell'URL per superare il controllo di sicurezza del backend
    return this.http.delete(`${this.apiUrl}/${id}?utenteId=${utenteId}`);
  }
}
