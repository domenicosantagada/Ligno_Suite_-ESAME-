import {HttpInterceptorFn} from '@angular/common/http';

/**
 * HTTP AUTH INTERCEPTOR
 *
 * Intercetta tutte le richieste HTTP in uscita dall'applicazione Angular.
 * Se è presente un token di autenticazione nel LocalStorage, lo aggiunge
 * automaticamente all'header "Authorization" utilizzando lo schema Bearer.
 *
 * Questo approccio consente di centralizzare la gestione dell'autenticazione
 * evitando di dover impostare manualmente l'header in ogni chiamata HTTP.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {

  /**
   * Recupera il token JWT dal LocalStorage che è stato precedentemente salvato in fase di login.
   */
  const token = localStorage.getItem('token');

  /**
   * Se il token è presente, viene creata una copia immutabile della richiesta originale
   * con l'aggiunta dell'header Authorization.
   */
  if (token) {
    const clonedReq = req.clone({
      setHeaders: {
        // Inserisce il token nello standard "Bearer <token>"
        Authorization: `Bearer ${token}`
      }
    });

    /**
     * Inoltra la richiesta modificata al prossimo handler della pipeline HTTP.
     */
    return next(clonedReq);
  }

  /**
   * Se il token non è disponibile (utente non autenticato o sessione non inizializzata),
   * la richiesta originale viene inoltrata senza alcuna modifica.
   */
  return next(req);
};
