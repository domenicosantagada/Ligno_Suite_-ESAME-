import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {Auth} from '../auth/auth';

export interface Articolo {
  id?: number;
  nome: string;
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
  private authService = inject(Auth);

  private apiUrl = 'http://localhost:8080/api/articoli';

  /**
   * Recupera gli articoli legati SOLO all'utente loggato
   */
  getArticoliDalDb(): Observable<Articolo[]> {
    const utente = this.authService.getUtenteLoggato();
    if (!utente) return throwError(() => new Error('Utente non loggato'));

    return this.http.get<Articolo[]>(`${this.apiUrl}/utente/${utente.id}`);
  }

  /**
   * Salva un nuovo articolo associandolo all'utente loggato
   */
  aggiungiArticolo(articolo: Articolo): Observable<Articolo> {
    const utente = this.authService.getUtenteLoggato();
    if (!utente) return throwError(() => new Error('Utente non loggato'));

    return this.http.post<Articolo>(`${this.apiUrl}/utente/${utente.id}`, articolo);
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
