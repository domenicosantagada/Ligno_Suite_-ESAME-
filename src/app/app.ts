import {Component, HostListener, inject, OnInit, signal} from '@angular/core';
import {Router, RouterLink, RouterOutlet} from '@angular/router';
import {Auth} from './auth/auth';

/**
 * Componente principale dell'applicazione.
 * Gestisce la navigazione e il menu di navigazione.
 */
@Component({
  selector: 'app-root',
  /* *
   * STANDALONE COMPONENT
   * - RouterOutlet: Serve per visualizzare i componenti associati alle rotte (es. Home, Login, Dashboard, etc.)
   * - RouterLink: Sostituisce l'attributo 'href' classico, permettendo di navigare senza ricaricare l'intera pagina web (Single Page Application).
   */
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  /* *
   * DEPENDENCY INJECTION
   */
  router = inject(Router); // Serve per comandare la navigazione via codice (es. dopo il logout, rimanda al Login)
  authService = inject(Auth); // servizio di autenticazione per gestire login/logout e stato di autenticazione

  // Teniamo traccia del signal utenteLoggato
  isLoggedIn = this.authService.utenteLoggato

  // Serve per gestire il menu dropdown di navigazione ("Gestione")
  menuGestioneAperto = signal(false);

  // NUOVO: Serve per gestire il menu a comparsa "Hamburger" su schermi piccoli (Smartphone)
  menuHamburgerAperto = signal(false);

  // Nome dell'applicazione
  protected readonly title = signal('LingoSuite');


  // Metodo per aprire o chiudere il menu dropdown di navigazione
  toggleMenuGestione(event: Event) {
    // Serve per "fermare" il click solamente sull'oggetto che ha generato l'evento,
    // evitando che venga propagato anche al di sotto e cosi al documento generando
    // la chiusura del menu causa fun. chiudiMenuSeClicchiFuori
    event.stopPropagation();

    // inverte il valore del menu (se è aperto lo chiude, se è chiuso lo apre)
    this.menuGestioneAperto.update(v => !v);
  }

  /**
   * Metodo per aprire o chiudere il menu Hamburger (su mobile)
   */
  toggleMenuHamburger(event: Event) {
    // Come per il menu gestione, blocca la propagazione del click per non farlo chiudere subito
    event.stopPropagation();

    // Inverte il valore del menu hamburger
    this.menuHamburgerAperto.update(v => !v);
  }

  /**
   * Metodo per chiudere esplicitamente l'Hamburger.
   * Viene richiamato dall'HTML ogni volta che clicchiamo su una voce del menu.
   */
  chiudiMenuHamburger() {
    this.menuHamburgerAperto.set(false);
  }

  /* *
   * @HostListener
   * Serve per ascoltare un evento su tutta la pagina web per poter chiudere il menu dropdown
   * e per il menu hamburger quando l'utente clicca fuori.
   */
  @HostListener('document:click')
  chiudiMenuSeClicchiFuori() {

    // Chiude il menu Gestione se era aperto
    if (this.menuGestioneAperto()) {
      this.menuGestioneAperto.set(false);
    }

    // NUOVO: Chiude anche il menu Hamburger se era aperto
    if (this.menuHamburgerAperto()) {
      this.menuHamburgerAperto.set(false);
    }
  }

  ngOnInit() {
    //  console.log("Avvio dell'applicazione");
  }

  /**
   * Metodo per effettuare il logout dell'utente.
   */
  logout() {
    // Chiama il servizio Auth per pulire i dati di sessione (es. cancella il localStorage)
    this.authService.logout();

    // Dopo il logout, rimanda l'utente alla pagina di login
    this.router.navigate(['/login']);
  }


  // Verifica se è loggato ed è un Cliente
  isCliente(): boolean {
    const u = this.authService.getUtenteLoggato();
    return u !== null && u.ruolo === 'CLIENTE';
  }

  // Verifica se è loggato ed è un Falegname (o profilo standard retrocompatibile)
  isFalegname(): boolean {
    const u = this.authService.getUtenteLoggato();
    return u !== null && u.ruolo !== 'CLIENTE';
  }
}
