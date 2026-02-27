import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {Auth} from './auth';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(Auth);
  const router = inject(Router);

  // Controlliamo se l'utente è loggato usando il metodo che hai già in Auth
  if (authService.getUtenteLoggato()) {
    return true; // Accesso consentito
  } else {
    // Se non c'è nessun utente, lo rimandiamo alla pagina di login
    router.navigate(['/login']);
    return false; // Accesso bloccato
  }
};
