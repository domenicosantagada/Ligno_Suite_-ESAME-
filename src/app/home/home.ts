import {Component, inject, OnInit, signal} from '@angular/core';
import {Auth} from '../auth/auth';
import {PreventiviService} from '../preventivi/preventivi.service';
import {RubricaService} from '../rubrica/rubrica.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {

  // Variabili reattive (Signals) collegate all'HTML
  nomeTitolare = signal<string>('');
  dataOggi = signal<string>('');
  totalePreventivi = signal<number>(0);
  ultimoPreventivoText = signal<string>('Nessun preventivo');
  ultimoPreventivoCliente = signal<string>('');
  totaleClienti = signal<number>(0);
  preventiviUltimi30Giorni = signal<number>(0);
  // Iniezione dei servizi necessari
  private authService = inject(Auth);
  private preventiviService = inject(PreventiviService);
  private rubricaService = inject(RubricaService);

  ngOnInit() {
    this.impostaDataOggi();
    this.caricaDatiUtente();
    this.caricaStatistiche();
  }

  /**
   * Calcola la data odierna in un formato leggibile e la capitalizza.
   */
  private impostaDataOggi() {
    const opzioni: Intl.DateTimeFormatOptions = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'};
    let data = new Date().toLocaleDateString('it-IT', opzioni);
    data = data.charAt(0).toUpperCase() + data.slice(1);
    this.dataOggi.set(data);
  }

  /**
   * Recupera i dati dell'utente loggato dal localStorage tramite il servizio Auth.
   */
  private caricaDatiUtente() {
    const utente = this.authService.getUtenteLoggato();
    if (utente) {
      // Diamo priorità assoluta al nome personale del titolare.
      // Se assente, ripieghiamo sul nome azienda o su un default.
      if (utente.nome && utente.nome.trim() !== '') {
        this.nomeTitolare.set(utente.nome);
      } else if (utente.nomeAzienda && utente.nomeAzienda.trim() !== '') {
        this.nomeTitolare.set(utente.nomeAzienda);
      } else {
        this.nomeTitolare.set('Artigiano');
      }
    }
  }

  /**
   * Effettua le chiamate al backend per scaricare le statistiche reali su preventivi e clienti.
   */
  private caricaStatistiche() {
    // 1. Carica Preventivi
    this.preventiviService.getTuttiIPreventivi().subscribe({
      next: (preventivi) => {
        if (preventivi && preventivi.length > 0) {
          this.totalePreventivi.set(preventivi.length);

          // Ordiniamo in base alla data per trovare quello più recente
          const ordinati = [...preventivi].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const ultimo = ordinati[0];

          const dataUltimoFormattata = new Date(ultimo.date).toLocaleDateString('it-IT');

          // Impostiamo sia la stringa descrittiva che il nome del cliente per l'ultimo preventivo
          this.ultimoPreventivoText.set(`N° ${ultimo.invoiceNumber} del ${dataUltimoFormattata}`);
          this.ultimoPreventivoCliente.set(ultimo.toName || 'Cliente non specificato');

          // Calcoliamo quanti preventivi appartengono agli ultimi 30 giorni
          const trentaGiorniFa = new Date();
          trentaGiorniFa.setDate(trentaGiorniFa.getDate() - 30);

          const preventiviRecenti = preventivi.filter(p => new Date(p.date) >= trentaGiorniFa);
          this.preventiviUltimi30Giorni.set(preventiviRecenti.length);
        } else {
          // Fallback se il database è vuoto
          this.totalePreventivi.set(0);
          this.preventiviUltimi30Giorni.set(0);
          this.ultimoPreventivoText.set('Nessun preventivo');
          this.ultimoPreventivoCliente.set('-');
        }
      },
      error: (err) => console.error('Errore nel caricamento dei preventivi', err)
    });

    // 2. Carica Clienti
    this.rubricaService.getClientiDalDb().subscribe({
      next: (clienti: any[]) => {
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
