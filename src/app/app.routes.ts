import {Routes} from '@angular/router';
import {Preventivi} from './preventivi/preventivi';
import {TaglioPannelli} from './taglio-pannelli/taglio-pannelli';
import {Prezzario} from './prezzario/prezzario';
import {Home} from './home/home';
import {ListaPreventivi} from './lista-preventivi/lista-preventivi';
import {Login} from './login/login'; // 1. Importa il componente Login

export const routes: Routes = [
  {path: "", redirectTo: "/login", pathMatch: "full"}, // 2. Modifica il redirect iniziale su /login
  {path: "login", component: Login}, // 3. Aggiungi la rotta di login
  {path: "home", component: Home},
  {path: "lista-preventivi", component: ListaPreventivi},
  {path: "preventivi", component: Preventivi},
  {path: "taglio-pannelli", component: TaglioPannelli},
  {path: "prezzario", component: Prezzario}
];
