import {Routes} from '@angular/router';
import {Preventivi} from './preventivi/preventivi';
import {TaglioPannelli} from './taglio-pannelli/taglio-pannelli';
import {Prezzario} from './prezzario/prezzario';
import {Home} from './home/home';
import {ListaPreventivi} from './lista-preventivi/lista-preventivi';

export const routes: Routes = [
  {path: "", redirectTo: "/home", pathMatch: "full"},
  {path: "home", component: Home},
  {path: "lista-preventivi", component: ListaPreventivi},
  {path: "preventivi", component: Preventivi},
  {path: "taglio-pannelli", component: TaglioPannelli},
  {path: "prezzario", component: Prezzario}
];
