import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

export interface Articolo {
  id?: number;
  nome: string;
  descrizione?: string; // ? serve per dire che può essere null o undefined
  prezzoAcquisto: number;
  fornitore: string;
  dataAcquisto: string | null; // Può essere stringa (YYYY-MM-DD) o null
  unitaMisura: string;
}

@Injectable({
  providedIn: 'root'
})
export class PrezzarioService {
  private http = inject(HttpClient);
  
  private apiUrl = 'http://localhost:8080/api/articoli';

  /**
   * Recupera gli articoli legati SOLO all'utente loggato
   */
  getArticoliDalDb(): Observable<Articolo[]> {
    return this.http.get<Articolo[]>(this.apiUrl);
  }

  /**
   * Salva un nuovo articolo associandolo all'utente loggato
   */
  aggiungiArticolo(articolo: Articolo): Observable<Articolo> {
    return this.http.post<Articolo>(this.apiUrl, articolo);
  }

  /**
   * Aggiorna un articolo esistente
   */
  modificaArticolo(id: number, articolo: Articolo): Observable<Articolo> {
    return this.http.put<Articolo>(`${this.apiUrl}/${id}`, articolo);
  }

  /**
   * Elimina un articolo in base al suo ID
   */
  eliminaArticolo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
