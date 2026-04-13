import {ApplicationConfig, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideRouter} from '@angular/router';

// Importa l'elenco delle rotte definite in app.routes.ts
import {routes} from './app.routes';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {authInterceptor} from './auth/auth.interceptor'; // Importiamo il nostro interceptor

export const appConfig: ApplicationConfig = {

  // Providers globali iniettabili tramite Dependency Injection (DI)
  providers: [
    provideBrowserGlobalErrorListeners(),
    // inizializza il router con le rotte definite in app.routes.ts
    provideRouter(routes),
    // Aggiungiamo l'interceptor al client HTTP
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
