import {bootstrapApplication} from '@angular/platform-browser';
// Importa le configurazioni globali (es. router, client HTTP)
import {appConfig} from './app/app.config';
// Importa il componente radice
import {App} from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
