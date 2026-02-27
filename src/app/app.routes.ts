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
import {authGuard} from './auth/auth.guard'; // 1. Importa il componente Login

export const routes: Routes = [

  // Per accedere direttamente alla lista dei preventivi
  //{path: "", redirectTo: "/lista-preventivi", pathMatch: "full"},

  // Ripristina il redirect iniziale
  {path: "", redirectTo: "/login", pathMatch: "full"}, // 2. Modifica il redirect iniziale su /login


  // Rotte PUBBLICHE (accessibili a tutti)
  {path: "login", component: Login}, // 3. Aggiungi la rotta di login
  {path: "register", component: Register}, // Aggiungi la rotta

  // Rotte PRIVATE (protette da authGuard)
  {path: "home", component: Home, canActivate: [authGuard]},
  {path: "lista-preventivi", component: ListaPreventivi, canActivate: [authGuard]},

  {
    path: "preventivi",
    component: Preventivi,
    canActivate: [authGuard],
    canDeactivate: [(component: Preventivi) => component.puoAbbandonarePagina()]
  },


  {path: "taglio-pannelli", component: TaglioPannelli, canActivate: [authGuard]},
  {path: "prezzario", component: Prezzario, canActivate: [authGuard]},
  {path: "rubrica", component: Rubrica, canActivate: [authGuard]},
  {path: "impostazioni", component: Impostazioni, canActivate: [authGuard]},
];
