import {ChangeDetectorRef, Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import Swal from 'sweetalert2'; // <-- Importazione di SweetAlert2
import {Pezzo, RisultatoOttimizzazione} from './taglio-pannelli.model';
import {TaglioPannelliService} from './taglio-pannelli.service';
import {CanvasTaglioComponent} from './taglio-pannelli.component';
import {Auth} from '../auth/auth';
import {ConfigurazionePdf, PdfGeneratorService} from './pdf-generator.service';
import {CsvGeneratorService, ImpostazioniCSV} from './csv-generator.service';

@Component({
  selector: 'app-taglio-pannelli',
  standalone: true,
  imports: [CommonModule, FormsModule, CanvasTaglioComponent],
  templateUrl: './taglio-pannelli.html',
  styleUrls: ['./taglio-pannelli.css']
})
export class TaglioPannelli {

  schedaAttiva: 'input' | 'risultato' = 'input';

  // Configurazione Pannello Iniziale (Altezza x Larghezza)
  presetPannello: string = '1220x2440';
  pannelloAltezza: number = 1220;
  pannelloLarghezza: number = 2440;
  spessoreLama: number = 4;
  marginePannello: number = 10;

  // Lista pezzi iniziale
  pezzi: Pezzo[] = [];

  risultatoOttimizzazione: RisultatoOttimizzazione | null = null;
  indicePannelloAttivo: number = 0;
  zoomImmagine: number = 30;

  isCalcoloInCorso: boolean = false;
  isGenerazionePdfInCorso: boolean = false;

  private taglioService = inject(TaglioPannelliService);
  private authService = inject(Auth);
  private cdr = inject(ChangeDetectorRef);
  private pdfService = inject(PdfGeneratorService);
  private csvService = inject(CsvGeneratorService);

  get quantitaTotale(): number {
    return this.pezzi.reduce((sum, p) => sum + (p.quantita || 0), 0);
  }

  // --- AZIONI UI ---
  cambiaScheda(scheda: 'input' | 'risultato') {
    this.schedaAttiva = scheda;
  }

  cambioPreset() {
    if (this.presetPannello !== 'custom') {
      const [h, w] = this.presetPannello.split('x'); // H x W
      this.pannelloAltezza = Number(h);
      this.pannelloLarghezza = Number(w);
    }
  }

  verificaPresetPersonalizzato() {
    const val = `${this.pannelloAltezza}x${this.pannelloLarghezza}`;
    // Valori validi invertiti (Alt x Larg)
    const presetValidi = ['1220x2440', '1250x2500', '2070x2800', '1300x3050', '2100x3120'];
    this.presetPannello = presetValidi.includes(val) ? val : 'custom';
  }

  aggiungiPezzo() {
    this.pezzi.push({
      nome: `Pezzo ${this.pezzi.length + 1}`, altezza: 400, larghezza: 300, quantita: 1, puoRuotare: true
    });
  }

  rimuoviPezzo(index: number) {
    this.pezzi.splice(index, 1);
  }

  // --- CONTROLLO REAL-TIME MISURE ---
  isFuoriMisura(p: Pezzo): boolean {
    // Se non ha ancora inserito le misure, non segnaliamo errore
    if (!p.altezza || !p.larghezza) return false;

    const hMax = this.pannelloAltezza - (this.marginePannello * 2);
    const wMax = this.pannelloLarghezza - (this.marginePannello * 2);

    const entraDritto = p.larghezza <= wMax && p.altezza <= hMax;
    const entraRuotato = p.puoRuotare && (p.altezza <= wMax && p.larghezza <= hMax);

    // Se non entra né dritto né ruotato, è fuori misura (restituisce true)
    return !(entraDritto || entraRuotato);
  }

// Verifica se specificamente l'ALTEZZA sta causando l'errore
  isAltezzaErrata(p: Pezzo): boolean {
    if (!p.altezza || !p.larghezza) return false;
    if (!this.isFuoriMisura(p)) return false; // Se entra tutto, nessun errore

    const hMax = this.pannelloAltezza - (this.marginePannello * 2);
    const wMax = this.pannelloLarghezza - (this.marginePannello * 2);

    if (!p.puoRuotare) {
      // Se non può ruotare, l'altezza deve entrare per forza nell'altezza del pannello
      return p.altezza > hMax;
    } else {
      // Se può ruotare, controlliamo i lati massimi e minimi
      const maxPannello = Math.max(hMax, wMax);
      const minPannello = Math.min(hMax, wMax);

      if (p.altezza > maxPannello) return true; // Supera addirittura il lato più lungo
      if (p.altezza > minPannello && p.larghezza > minPannello) return true; // Entrambi superano il lato corto
      return false;
    }
  }

  // Verifica se specificamente la LARGHEZZA sta causando l'errore
  isLarghezzaErrata(p: Pezzo): boolean {
    if (!p.altezza || !p.larghezza) return false;
    if (!this.isFuoriMisura(p)) return false;

    const hMax = this.pannelloAltezza - (this.marginePannello * 2);
    const wMax = this.pannelloLarghezza - (this.marginePannello * 2);

    if (!p.puoRuotare) {
      // Se non può ruotare, la larghezza deve entrare nella larghezza del pannello
      return p.larghezza > wMax;
    } else {
      const maxPannello = Math.max(hMax, wMax);
      const minPannello = Math.min(hMax, wMax);

      if (p.larghezza > maxPannello) return true; // Supera addirittura il lato più lungo
      if (p.altezza > minPannello && p.larghezza > minPannello) return true; // Entrambi superano il lato corto
      return false;
    }
  }

  calcolaTaglio() {
    // Filtriamo i pezzi per assicurarci che abbiano misure e quantità valide
    const pezziValidi = this.pezzi.filter(p => p.larghezza > 0 && p.altezza > 0 && p.quantita > 0);

    if (pezziValidi.length === 0) {
      Swal.fire('Attenzione', 'Inserisci almeno un pezzo nella distinta con dimensioni e quantità valide prima di calcolare l\'ottimizzazione.', 'warning');
      this.risultatoOttimizzazione = null;
      return;
    }

    // --- CONTROLLO: Verifica pezzi fisicamente impossibili ---
    const hMax = this.pannelloAltezza - (this.marginePannello * 2);
    const wMax = this.pannelloLarghezza - (this.marginePannello * 2);

    const pezziImpossibili = pezziValidi.filter(p => {
      const entraDritto = p.larghezza <= wMax && p.altezza <= hMax;
      const entraRuotato = p.puoRuotare && (p.altezza <= wMax && p.larghezza <= hMax);
      return !(entraDritto || entraRuotato);
    });

    if (pezziImpossibili.length > 0) {
      const nomi = pezziImpossibili.map(p => `<b>${p.nome}</b>`).join('<br>');
      Swal.fire({
        title: 'Pezzi fuori misura!',
        html: `I seguenti pezzi sono più grandi del pannello (considerando i margini e i vincoli di rotazione) e non possono essere tagliati:<br><br>${nomi}<br><br>Modificali o rimuovili per procedere.`,
        icon: 'error',
        confirmButtonColor: '#212529'
      });
      return; // Blocchiamo il calcolo
    }
    // -------------------------------------------------------------

    // ---> ATTIVIAMO LA BARRA DI CARICAMENTO <---
    this.isCalcoloInCorso = true;

    // Chiamata asincrona al Backend (Spring Boot)
    this.taglioService.ottimizzaTaglio(
      this.pannelloLarghezza, this.pannelloAltezza, this.spessoreLama, this.marginePannello, pezziValidi
    ).subscribe({
      next: (risultatoDalServer) => {
        // ---> DISATTIVIAMO LA BARRA DI CARICAMENTO <---
        this.isCalcoloInCorso = false;

        this.risultatoOttimizzazione = risultatoDalServer;
        this.indicePannelloAttivo = 0;
        this.cambiaScheda('risultato');

        this.cdr.detectChanges();
      },
      error: (err) => {
        // ---> DISATTIVIAMO LA BARRA DI CARICAMENTO ANCHE IN CASO DI ERRORE <---
        this.isCalcoloInCorso = false;

        console.error("Errore di connessione al backend:", err);
        Swal.fire('Errore di Calcolo', 'Impossibile connettersi al server...', 'error');
      }
    });
  }

// --- ESPORTAZIONE PDF ---
  async esportaPDF() {
    if (!this.risultatoOttimizzazione) return;

    this.isGenerazionePdfInCorso = true;
    this.cdr.detectChanges(); // Mostriamo lo spinner

    try {
      // 1. Prepariamo i dati di configurazione
      const config: ConfigurazionePdf = {
        pannelloAltezza: this.pannelloAltezza,
        pannelloLarghezza: this.pannelloLarghezza,
        spessoreLama: this.spessoreLama,
        quantitaTotale: this.quantitaTotale
      };

      // 2. Recuperiamo il logo (se esiste)
      let logoAziendale: string | undefined;
      const utente = this.authService.getUtenteLoggato();
      if (utente && utente.logoBase64) {
        logoAziendale = utente.logoBase64 as string;
      }

      // 3. Deleghiamo il lavoro pesante al Servizio Esterno
      await this.pdfService.generaEScaricaPDF(this.risultatoOttimizzazione, config, logoAziendale);

    } catch (error) {
      console.error("Errore durante la generazione del PDF:", error);
      Swal.fire('Errore', 'Si è verificato un errore durante la creazione del PDF.', 'error');
    } finally {
      this.isGenerazionePdfInCorso = false;
      this.cdr.detectChanges(); // Spegniamo lo spinner
    }
  }

  // --- ESPORTAZIONE CSV ---
  esportaCSV() {
    const impostazioni: ImpostazioniCSV = {
      pannelloAltezza: this.pannelloAltezza,
      pannelloLarghezza: this.pannelloLarghezza,
      spessoreLama: this.spessoreLama,
      marginePannello: this.marginePannello
    };

    // Il servizio fa tutto il lavoro di generazione e download
    this.csvService.esportaCSV(impostazioni, this.pezzi);
  }

  // --- IMPORTAZIONE CSV ---
  async importaCSV() {
    try {
      // Aspettiamo che il servizio legga il file e ci restituisca i dati
      const datiImportati = await this.csvService.importaCSV();

      // 1. Reset totale dell'ambiente
      this.risultatoOttimizzazione = null;
      this.indicePannelloAttivo = 0;
      this.zoomImmagine = 30;

      // 2. Aggiornamento impostazioni pannello
      this.pannelloAltezza = datiImportati.impostazioni.pannelloAltezza;
      this.pannelloLarghezza = datiImportati.impostazioni.pannelloLarghezza;
      this.spessoreLama = datiImportati.impostazioni.spessoreLama;
      this.marginePannello = datiImportati.impostazioni.marginePannello;

      this.verificaPresetPersonalizzato(); // Aggiorniamo la tendina della UI

      // 3. Aggiornamento distinta pezzi
      this.pezzi = datiImportati.pezzi;

      // 4. Feedback visivo
      Swal.fire({
        title: 'Distinta Importata!',
        text: `Configurazione caricata e ${this.pezzi.length} pezzi aggiunti in lista.`,
        icon: 'success',
        confirmButtonColor: '#212529',
        timer: 1500,
        showConfirmButton: false
      });

      this.cdr.detectChanges(); // Forziamo l'aggiornamento della UI

    } catch (error) {
      console.error("Errore importazione CSV:", error);
      Swal.fire('Errore', 'Impossibile leggere il file CSV. Assicurati che sia stato generato dal sistema e non manomesso.', 'error');
    }
  }
}
