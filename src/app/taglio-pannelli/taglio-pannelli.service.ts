import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Pezzo, RisultatoOttimizzazione} from './taglio-pannelli.model';

@Injectable({
  providedIn: 'root'
})
export class TaglioPannelliService {

  private http = inject(HttpClient);
  // Assicurati che l'URL punti alla porta del tuo Spring Boot
  private apiUrl = 'http://localhost:8080/api/ottimizzazione/calcola';

  // Adesso ritorna un Observable, perché la chiamata è asincrona!
  public ottimizzaTaglio(larghezzaPannello: number, altezzaPannello: number, spessoreLama: number, margine: number, pezziInput: Pezzo[]): Observable<RisultatoOttimizzazione> {

    const payload = {
      pannelloLarghezza: larghezzaPannello,
      pannelloAltezza: altezzaPannello,
      spessoreLama: spessoreLama,
      margine: margine,
      pezzi: pezziInput
    };

    return this.http.post<RisultatoOttimizzazione>(this.apiUrl, payload);
  }
}
