import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Cliente} from './rubrica';

/**
 * SERVIZIO RUBRICA (Data Access Layer - Clienti)
 *
 * Servizio responsabile della comunicazione con il backend per tutte le operazioni
 * CRUD relative all'entità Cliente.
 *
 * providedIn: 'root' → singleton a livello applicativo (un'unica istanza condivisa).
 */
@Injectable({
  providedIn: 'root'
})
export class RubricaService {

  /**
   * HttpClient utilizzato per effettuare richieste HTTP verso il backend REST.
   */
  private http = inject(HttpClient);

  /**
   * Endpoint base dell'API REST esposta dal backend (Spring Boot).
   * Tutte le operazioni sui clienti vengono costruite a partire da questo URL.
   */
  private apiUrl = 'http://localhost:8080/api/clienti';

  /**
   * RECUPERO LISTA CLIENTI
   *
   * Effettua una richiesta HTTP GET verso l'endpoint /api/clienti
   * e restituisce un Observable tipizzato contenente un array di Cliente.
   *
   * La responsabilità del filtraggio (es. per utente) è delegata al backend.
   */
  getClientiDalDb() {
    return this.http.get<Cliente[]>(this.apiUrl);
  }

  /**
   * CREAZIONE O AGGIORNAMENTO CLIENTE
   *
   * Determina automaticamente il tipo di operazione:
   *
   * - UPDATE (PUT): se cliente.id è valorizzato → entità già persistita
   * - CREATE (POST): se cliente.id è assente → nuova entità
   *
   * REST semantics:
   * - PUT   /api/clienti/{id} → aggiornamento risorsa esistente
   * - POST  /api/clienti      → creazione nuova risorsa
   */
  salvaClienteNelDb(cliente: Cliente) {

    if (cliente.id) {
      /**
       * UPDATE
       *
       * Invia una richiesta PUT all'endpoint specifico della risorsa.
       * Il backend si aspetta un'entità già esistente da aggiornare.
       */
      return this.http.put<Cliente>(
        `${this.apiUrl}/${cliente.id}`,
        cliente
      );

    } else {
      /**
       * CREATE
       *
       * Invia una richiesta POST all'endpoint base.
       * Il backend creerà una nuova risorsa e tipicamente restituirà
       * l'entità completa con ID generato.
       */
      return this.http.post<Cliente>(
        this.apiUrl,
        cliente
      );
    }
  }

  /**
   * ELIMINAZIONE CLIENTE
   *
   * Effettua una richiesta DELETE sull'endpoint della specifica risorsa.
   *
   * @param id Identificatore univoco del cliente (numerico o stringa)
   */
  eliminaClienteDalDb(id: number | string) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
