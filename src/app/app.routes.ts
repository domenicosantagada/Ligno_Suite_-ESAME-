import {Routes} from '@angular/router';
import {Preventivi} from './preventivi/preventivi';
import {TaglioPannelli} from './taglio-pannelli/taglio-pannelli';
import {Prezzario} from './prezzario/prezzario';
import {Home} from './home/home';
import {ListaPreventivi} from './lista-preventivi/lista-preventivi';
import {Login} from './login/login';
import {Register} from './register/register';
import {Rubrica} from './rubrica/rubrica';
import {Impostazioni} from './impostazioni/impostazioni';
import {authGuard} from './auth/auth.guard';
import {DashboardCliente} from './dashboard-cliente/dashboard-cliente';
import {ImpostazioniCliente} from './impostazioni-cliente/impostazioni-cliente';

/**
 * array delle ROTTE dell'applicazione.
 * Ogni oggetto rappresenta una rotta, con: path, componente da caricare, canActivate, etc.
 */
export const routes: Routes = [

  /* * ROTTA DI DEFAULT (Root)
   * Se l'utente digita solo "localhost:4200/", Angular lo reindirizza (redirectTo) a "/login".
   * pathMatch: "full" significa che l'URL deve essere ESATTAMENTE vuoto per far scattare questo redirect.
   */
  {path: "", redirectTo: "/login", pathMatch: "full"},


  // --- ROTTE PUBBLICHE (accessibili senza essere loggati) ---
  {path: "login", component: Login},
  {path: "register", component: Register},

  // --- ROTTE PRIVATE (Dashboard dell'utente) ---
  /*
   * canActivate: [authGuard] è un Guard di autenticazione che protegge la rotta.
   * Prima di caricare il componente "Home", Angular esegue il codice dentro authGuard.
   * Se authGuard restituisce 'true' (l'utente ha fatto il login), lo fa passare.
   * Se restituisce 'false' (non è loggato), blocca la navigazione e di solito lo rimanda al Login.
   */
  {path: "home", component: Home, canActivate: [authGuard]},
  {path: "lista-preventivi", component: ListaPreventivi, canActivate: [authGuard]},

  {
    path: "preventivi",
    component: Preventivi,
    canActivate: [authGuard],
    /*
     * canDeactivate è un Guard in uscita.
     * Serve a bloccare l'utente se sta cercando di uscire dalla pagina.
     * Molto utile se l'utente sta compilando un preventivo e preme "Indietro" per sbaglio:
     * chiama il metodo 'puoAbbandonarePagina()' del componente Preventivi per mostrare
     * un popup "Vuoi davvero uscire? I dati non salvati andranno persi!".
     */
    canDeactivate: [(component: Preventivi) => component.puoAbbandonarePagina()]
  },

  {path: "taglio-pannelli", component: TaglioPannelli, canActivate: [authGuard]},
  {path: "prezzario", component: Prezzario, canActivate: [authGuard]},
  {path: "rubrica", component: Rubrica, canActivate: [authGuard]},
  {path: "impostazioni", component: Impostazioni, canActivate: [authGuard]},

  /**
   * Rotte per il cliente (accessibili solo se l'utente è loggato come cliente)
   * Anche queste rotte sono protette da authGuard, che verifica se l'utente è autenticato e ha il ruolo di cliente.
   */
  {path: "dashboard-cliente", component: DashboardCliente, canActivate: [authGuard]},
  {path: "impostazioni-cliente", component: ImpostazioniCliente, canActivate: [authGuard]}
];
