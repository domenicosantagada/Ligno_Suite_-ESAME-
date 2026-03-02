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
   * Invece di usare un noioso app.module.ts, importiamo direttamente qui
   * gli strumenti che ci servono per il template HTML di questo componente.
   * - RouterOutlet: È il "buco" nel template dove il Router inietterà i componenti (es. Login, Home).
   * - RouterLink: Sostituisce l'attributo 'href' classico, permettendo di navigare
   * senza ricaricare l'intera pagina web (Single Page Application).
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
  authService = inject(Auth); // servizio di autenticazzione per gestire login/logout e stato di autenticazione

  // Serve per gestire il menu dropdown di navigazione, essendo un signal Angular sa immediatamente quando cambia il valore
  menuGestioneAperto = signal(false);
  protected readonly title = signal('LingoSuite'); // Nome dell'applicazione


  // Metodo per aprire o chiudere il menu dropdown di navigazione
  toggleMenuGestione(event: Event) {
    // Serve per "fermare" il click solamente sull'oggetto che ha generato l'evento,
    // evitando che venga propagato anche al di sotto e cosi al documento generando
    // la chiusura del menu causa fun. chiuduMenuSeClicchiFuori
    event.stopPropagation();

    // iverte il valore del menu (se è aperto lo chiude, se è chiuso lo apre)
    this.menuGestioneAperto.update(v => !v);
  }

  /* *
   * @HostListener
   * Serve per ascoltare un evento a livello di documento (in questo caso, un click ovunque sulla pagina).
   * Cosi possiamo chiudere il menu dropdown di navigazione quando clicchi fuori di esso.
   */
  @HostListener('document:click')
  chiudiMenuSeClicchiFuori() {
    if (this.menuGestioneAperto()) {
      this.menuGestioneAperto.set(false);
    }
  }

  ngOnInit() {
    //  console.log("Avvio dell'applicazione");
  }

  /**
   * Metodo per effettuare il logout dell'utente.
   */
  logout() {
    // 1. Chiama il servizio Auth per pulire i dati di sessione (es. cancella il localStorage)
    this.authService.logout();

    // 2. Forza il cambio pagina verso la rotta pubblica di login
    this.router.navigate(['/login']);
  }
}
