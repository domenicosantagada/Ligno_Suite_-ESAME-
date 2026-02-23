import {Routes} from '@angular/router';
import {Preventivi} from './preventivi/preventivi';
import {TaglioPannelli} from './taglio-pannelli/taglio-pannelli';
import {Prezzario} from './prezzario/prezzario';
import {Home} from './home/home';

export const routes: Routes = [
  {path: "", redirectTo: "/preventivi", pathMatch: "full"},
  {path: "home", component: Home},
  {path: "preventivi", component: Preventivi},
  {path: "taglio-pannelli", component: TaglioPannelli},
  {path: "prezzario", component: Prezzario}
];
