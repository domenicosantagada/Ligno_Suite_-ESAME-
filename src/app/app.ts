import {Component, HostListener, inject, OnInit, signal} from '@angular/core';
import {Router, RouterLink, RouterOutlet} from '@angular/router';
import {Auth} from './auth/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})

/*
export class App {
  router = inject(Router);
  authService = inject(Auth); // Inietta il servizio
  protected readonly title = signal('ToolFalegnameria');

  logout() {
    this.authService.logout(); // Cancella i dati dal localStorage
    this.router.navigate(['/login']);
  }
}
*/


export class App implements OnInit { // <-- Implementa OnInit
  router = inject(Router);
  authService = inject(Auth);
  // 1. AGGIUNGI QUESTO SIGNAL
  menuGestioneAperto = signal(false);
  protected readonly title = signal('ToolFalegnameria');

  // 2. Modifica questo metodo per ricevere l'evento
  toggleMenuGestione(event: Event) {
    event.stopPropagation(); // <-- FONDAMENTALE: Dice al browser "Fermati qui, non avvisare il resto della pagina del click"
    this.menuGestioneAperto.update(v => !v);
  }

  // 3. AGGIUNGI QUESTO BLOCCO: Ascolta i click su tutta la pagina
  @HostListener('document:click')
  chiudiMenuSeClicchiFuori() {
    // Se il menu è aperto e clicchi in un punto qualsiasi dello schermo, si chiude
    if (this.menuGestioneAperto()) {
      this.menuGestioneAperto.set(false);
    }
  }

  // AGGIUNGI QUESTO METODO: Verrà eseguito in automatico all'avvio dell'app
  ngOnInit() {
    // ---- TRUCCO PER LO SVILUPPO (Da rimuovere in produzione) ----
    const utenteAttuale = this.authService.getUtenteLoggato();

    if (!utenteAttuale) {
      // Simuliamo un utente loggato (assicurati che l'ID 1 o 2 esista nel tuo DB H2 se vuoi coerenza,
      // altrimenti verranno salvati con ID 1 senza problemi)
      const utenteDev = {id: 1, nome: 'Sviluppatore Veloce', email: 'dev@test.it'};
      this.authService.setUtenteLoggato(utenteDev);
      console.warn('⚠️ DEV MODE ATTIVA: Auto-login effettuato come Sviluppatore.');
    }
    // --------------------------------------------------------------
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
