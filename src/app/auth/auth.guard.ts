import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {Auth} from './auth';

/**
 * AUTH GUARD (Guardia di Autenticazione)
 * Tipo: CanActivateFn (Interfaccia funzionale)
 * Scopo: Proteggere le rotte private. Se un utente prova a digitare l'URL di una pagina
 * riservata (es. /home) senza essere loggato, questa funzione lo intercetta.
 */
export const authGuard: CanActivateFn = (route, state) => {

  // DEPENDENCY INJECTION FUNZIONALE
  const authService = inject(Auth); // Il nostro servizio che gestisce il LocalStorage
  const router = inject(Router);   // Il router di Angular per gestire i reindirizzamenti

  /**
   * 1. IL CONTROLLO
   * Chiamiamo il metodo getUtenteLoggato() del servizio Auth.
   * Questo metodo controlla se nel LocalStorage del browser esiste la chiave 'utente'.
   */
  if (authService.getUtenteLoggato()) {

    // CASO A: L'utente esiste (è loggato).
    // Restituiamo 'true': il semaforo diventa verde e Angular carica il componente della pagina.
    return true;

  } else {

    // CASO B: L'utente NON esiste (non è loggato o ha cancellato i dati).

    /**
     * 2. IL REINDIRIZZAMENTO (Fallback)
     * Non basta bloccare l'utente; dobbiamo portarlo in un posto sicuro.
     * Usiamo router.navigate per rispedirlo alla pagina di login.
     */
    router.navigate(['/login']);

    // 3. IL BLOCCO
    // Restituiamo 'false': il semaforo è rosso e la navigazione viene annullata.
    return false;
  }
};
