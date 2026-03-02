import {ApplicationConfig, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideRouter} from '@angular/router';

// Importa l'elenco delle rotte definite in app.routes.ts
import {routes} from './app.routes';
// Serve per far comunicare Angular con il servizio HTTP (servizio di backend -> Spring Boot)
import {provideHttpClient} from '@angular/common/http';

export const appConfig: ApplicationConfig = {

  // Providers globali iniettabili tramite Dependency Injection (DI)
  providers: [
    provideBrowserGlobalErrorListeners(),
    // inizializza il router con le rotte definite in app.routes.ts
    provideRouter(routes),
    // inizializza il modulo http usato nei componenti (service) per fare chiamate GET, POST, PUT, DELETE
    provideHttpClient()
  ]
};
