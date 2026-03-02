import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

/**
 * SERVIZIO DI AUTENTICAZIONE E GESTIONE SESSIONE
 * @Injectable: Definisce la classe come un servizio che può essere iniettato.
 * providedIn: 'root' garantisce che il servizio sia un "Singleton", ovvero ne esiste
 * una sola istanza condivisa tra tutti i componenti dell'applicazione.
 */
@Injectable({
  providedIn: 'root'
})
export class Auth {
  // Client HTTP per effettuare le richieste REST verso il backend Spring Boot
  // Una richiesta REST è una richiesta HTTP che invia dati al server per ottenere risultati.
  // REST sta per Representational State Transfer, che significa "Trasferimento di stato rappresentativo".
  private http = inject(HttpClient);

  // Endpoint base per le API di autenticazione del backend
  private apiUrl = 'http://localhost:8080/api/auth';

  /**
   * Effettua la richiesta di Login al backend.
   * @param dati Oggetto contenente le credenziali (email e password).
   * @returns Un Observable che emetterà i dati dell'utente se le credenziali sono corrette.
   */
  login(dati: any) {
    return this.http.post(`${this.apiUrl}/login`, dati);
  }

  /**
   * Invia i dati di registrazione per creare un nuovo profilo Utente.
   */
  register(dati: any) {
    return this.http.post(`${this.apiUrl}/register`, dati);
  }

  /**
   * Aggiorna i dati del profilo aziendale sul database.
   * Utilizza il metodo HTTP PUT per la modifica di una risorsa esistente.
   */
  updateProfilo(id: number, dati: any) {
    return this.http.put(`${this.apiUrl}/update/${id}`, dati);
  }

  /* ==========================================================================
     GESTIONE DELLA PERSISTENZA (SESSIONE LOCALE)
     Questi metodi gestiscono il LocalStorage per mantenere l'utente loggato
     anche dopo il ricaricamento della pagina (F5).
     ========================================================================== */

  /**
   * Memorizza l'oggetto utente nel browser.
   * Trasforma l'oggetto JavaScript in una stringa JSON, poiché il LocalStorage
   * può salvare solo dati testuali.
   */
  setUtenteLoggato(utente: any) {
    localStorage.setItem('utente', JSON.stringify(utente));
  }

  /**
   * Recupera i dati dell'utente attualmente loggato.
   * Esegue il "parsing" della stringa JSON per tornare a un oggetto utilizzabile dal codice.
   * @returns L'oggetto utente o null se non è stata trovata alcuna sessione attiva.
   */
  getUtenteLoggato() {
    const utenteString = localStorage.getItem('utente');
    return utenteString ? JSON.parse(utenteString) : null;
  }

  /**
   * Effettua il logout distruggendo la sessione locale.
   * Rimuove la chiave 'utente' dal LocalStorage, invalidando l'accesso lato client.
   */
  logout() {
    localStorage.removeItem('utente');
  }
}
