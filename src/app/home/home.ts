import {Component, inject, OnInit, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Auth} from '../auth/auth';
import {PreventiviService} from '../preventivi/preventivi.service';
import {RubricaService} from '../rubrica/rubrica.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {

  nomeTitolare = signal<string>('');
  dataOggi = signal<string>('');
  totalePreventivi = signal<number>(0);
  ultimoPreventivoText = signal<string>('Nessun preventivo');
  totaleClienti = signal<number>(0);
  preventiviUltimi30Giorni = signal<number>(0);
  private authService = inject(Auth);
  private preventiviService = inject(PreventiviService);
  private rubricaService = inject(RubricaService);

  ngOnInit() {
    this.impostaDataOggi();
    this.caricaDatiUtente();
    this.caricaStatistiche();
  }

  private impostaDataOggi() {
    const opzioni: Intl.DateTimeFormatOptions = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'};
    let data = new Date().toLocaleDateString('it-IT', opzioni);
    data = data.charAt(0).toUpperCase() + data.slice(1);
    this.dataOggi.set(data);
  }

  private caricaDatiUtente() {
    const utente = this.authService.getUtenteLoggato();
    if (utente) {
      this.nomeTitolare.set(utente.nomeAzienda || utente.nome || 'Artigiano');
    }
  }

  private caricaStatistiche() {
    // 1. Carica Preventivi
    this.preventiviService.getTuttiIPreventivi().subscribe({
      next: (preventivi) => {
        // Controllo di sicurezza per evitare errori se l'array è nullo
        if (preventivi && preventivi.length > 0) {
          this.totalePreventivi.set(preventivi.length);

          const ordinati = [...preventivi].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const ultimo = ordinati[0];

          const dataUltimoFormattata = new Date(ultimo.date).toLocaleDateString('it-IT');
          this.ultimoPreventivoText.set(`N° ${ultimo.invoiceNumber} del ${dataUltimoFormattata}`);

          const trentaGiorniFa = new Date();
          trentaGiorniFa.setDate(trentaGiorniFa.getDate() - 30);

          const preventiviRecenti = preventivi.filter(p => new Date(p.date) >= trentaGiorniFa);
          this.preventiviUltimi30Giorni.set(preventiviRecenti.length);
        } else {
          // Se non ci sono preventivi, i valori restano a zero
          this.totalePreventivi.set(0);
          this.preventiviUltimi30Giorni.set(0);
        }
      },
      error: (err) => console.error('Errore nel caricamento dei preventivi', err)
    });

    // 2. Carica Clienti (con Tipizzazione Esplicita per evitare l'errore TypeScript)
    this.rubricaService.getClientiDalDb().subscribe({
      next: (clienti: any[]) => { // <-- Abbiamo forzato TypeScript a riconoscerlo come array
        if (clienti && Array.isArray(clienti)) {
          this.totaleClienti.set(clienti.length);
        } else {
          this.totaleClienti.set(0);
        }
      },
      error: (err) => console.error('Errore nel caricamento dei clienti', err)
    });
  }
}
