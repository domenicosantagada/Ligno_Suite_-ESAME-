import {Routes} from '@angular/router';
import {Preventivi} from './preventivi/preventivi';
import {TaglioPannelli} from './taglio-pannelli/taglio-pannelli';
import {Prezzario} from './prezzario/prezzario';
import {Home} from './home/home';
import {ListaPreventivi} from './lista-preventivi/lista-preventivi';
import {Login} from './login/login';
import {Register} from './register/register';
import {Rubrica} from './rubrica/rubrica';
import {Impostazioni} from './impostazioni/impostazioni'; // 1. Importa il componente Login

export const routes: Routes = [

  // Per accedere direttamente alla lista dei preventivi
  //{path: "", redirectTo: "/lista-preventivi", pathMatch: "full"},

  // Ripristina il redirect iniziale
  {path: "", redirectTo: "/login", pathMatch: "full"}, // 2. Modifica il redirect iniziale su /login


  {path: "login", component: Login}, // 3. Aggiungi la rotta di login
  {path: "register", component: Register}, // Aggiungi la rotta
  {path: "home", component: Home},
  {path: "lista-preventivi", component: ListaPreventivi},
  {path: "preventivi", component: Preventivi},
  {path: "taglio-pannelli", component: TaglioPannelli},
  {path: "prezzario", component: Prezzario},
  {path: "rubrica", component: Rubrica},
  {path: "impostazioni", component: Impostazioni}


];
