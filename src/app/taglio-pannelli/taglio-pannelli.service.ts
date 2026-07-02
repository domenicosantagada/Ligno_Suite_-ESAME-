import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Pezzo, RisultatoOttimizzazione} from './taglio-pannelli.model';

/**
 * SERVIZIO OTTIMIZZAZIONE TAGLIO PANNELLI
 *
 * Responsabile dell'invocazione dell'API backend che esegue
 * l'algoritmo di ottimizzazione del taglio.
 *
 * Espone un metodo che costruisce il payload richiesto dal backend
 * e restituisce il risultato già tipizzato.
 */
@Injectable({
  providedIn: 'root'
})
export class TaglioPannelliService {

  /**
   * Client HTTP Angular per comunicazione REST
   */
  private http = inject(HttpClient);

  /**
   * Endpoint backend che esegue il calcolo dell'ottimizzazione
   */
  private apiUrl = 'http://localhost:8080/api/ottimizzazione/calcola';

  /**
   * Esegue l'ottimizzazione del taglio pannelli.
   *
   * Costruisce il payload conforme al contratto API e invia una richiesta POST.
   *
   * @param larghezzaPannello larghezza del pannello grezzo
   * @param altezzaPannello altezza del pannello grezzo
   * @param spessoreLama spessore della lama (kerf), usato per il calcolo delle perdite
   * @param margine margine di sicurezza dai bordi del pannello
   * @param pezziInput lista dei pezzi da posizionare
   *
   * @returns Observable contenente il risultato dell'ottimizzazione:
   *          - pannelli generati
   *          - efficienza
   *          - area utilizzata e scarti
   */
  public ottimizzaTaglio(
    larghezzaPannello: number,
    altezzaPannello: number,
    spessoreLama: number,
    margine: number,
    pezziInput: Pezzo[]
  ): Observable<RisultatoOttimizzazione> {

    /**
     * Payload inviato al backend.
     */
    const payload = {
      pannelloLarghezza: larghezzaPannello,
      pannelloAltezza: altezzaPannello,
      spessoreLama: spessoreLama,
      margine: margine,
      pezzi: pezziInput
    };

    /**
     * POST verso l'endpoint di calcolo.
     */
    return this.http.post<RisultatoOttimizzazione>(
      this.apiUrl,
      payload
    );
  }
}
