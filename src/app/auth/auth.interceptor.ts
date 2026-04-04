import {HttpInterceptorFn} from '@angular/common/http';

/**
 * HTTP INTERCEPTOR
 * Questa funzione intercetta TUTTE le chiamate HTTP in uscita dall'applicazione.
 * Se trova un token salvato nel LocalStorage, lo aggiunge all'header della richiesta
 * sotto forma di "Authorization: Bearer <token>".
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Recupera il token salvato durante il login
  const token = localStorage.getItem('token');

  if (token) {
    // Le richieste HTTP in Angular sono immutabili, quindi dobbiamo "clonare"
    // la richiesta originale per poterne modificare gli header.
    const clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    // Inoltra la richiesta modificata
    return next(clonedReq);
  }

  // Se non c'è token (es. utente non loggato), inoltra la richiesta originale senza modifiche
  return next(req);
};
