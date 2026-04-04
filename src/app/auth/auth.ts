import {inject, Injectable, signal} from '@angular/core';
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

  // Signal che tiene traccia se l'utente è loggato o meno
  // con !! trasformiamo il risultato in un booleano (true se c'è un utente, false se null)
  utenteLoggato = signal<boolean>(!!this.getUtenteLoggato());

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
  updateProfilo(dati: any) {
    return this.http.put(`${this.apiUrl}/update`, dati);
  }


  /**
   *  Recupera i dati del profilo personale dell'utente loggato.
   *  Utilizza il metodo HTTP GET per ottenere le informazioni dal server.
   */
  getProfiloPersonale() {
    return this.http.get(`${this.apiUrl}/me`);
  }

  /**
   *  Settiamo la sessione dell'utente dopo un login o una registrazione riusciti.
   *  Salviamo il token di autenticazione e i dati dell'utente nel LocalStorage del browser.
   *  Aggiorniamo la signal utenteLoggato a true per indicare che l'utente è ora loggato.
   */
  setSessione(token: string, utente: any) {
    localStorage.setItem('token', token);
    localStorage.setItem('utente', JSON.stringify(utente));
    this.utenteLoggato.set(true);
  }

  /**
   * Recupera i dati dell'utente loggato dal LocalStorage.
   * Se i dati esistono, li restituisce come oggetto JSON. Altrimenti, restituisce null.
   */
  getUtenteLoggato() {
    const utenteString = localStorage.getItem('utente');
    return utenteString ? JSON.parse(utenteString) : null;
  }

  /**
   * Effettua il logout dell'utente. Rimuove il token e i dati dell'utente dal LocalStorage,
   * aggiorna la signal utenteLoggato a false e reindirizza l'utente alla pagina di login.
   */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('utente');
    this.utenteLoggato.set(false);
    window.location.href = '/login';
  }

  // Aggiorna solo i dati utente nel LocalStorage (usato quando si modifica il profilo)
  aggiornaUtenteLocale(utente: any) {
    localStorage.setItem('utente', JSON.stringify(utente));
    this.utenteLoggato.set(true);
  }
}
