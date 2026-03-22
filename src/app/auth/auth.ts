import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

/**
 * SERVIZIO DI AUTENTICAZIONE E GESTIONE SESSIONE
 * @Injectable: Decoratore Angular che serve a dichiarare che la classe può partecipare al sistema di Dependency Injection (DI).
 * providedIn: 'root' indica che questo servizio è singleton globale
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
   * dati: Un oggetto che contiene le credenziali dell'utente in formato JSON.
   * Restituisce un Observable che rappresenta la risposta del server
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
     anche dopo il ricaricamento della pagina.
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
   * Recupera i dati dell'utente attualmente loggato dal LocalStorage.
   * Controlla se esiste la chiave 'utente' e, se sì, converte la stringa JSON
   * in un oggetto JavaScript. Se la chiave non esiste, restituisce null.
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

    // Ricarica la pagina e porta l'utente al login
    window.location.href = '/login';
  }

  /**
   * Recupera i dati di un utente specifico dal database usando il suo ID.
   */
  getUtenteById(id: number) {
    return this.http.get(`${this.apiUrl}/${id}`);
  }
}
