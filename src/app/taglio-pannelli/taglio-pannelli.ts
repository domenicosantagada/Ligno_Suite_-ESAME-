import {ChangeDetectorRef, Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {jsPDF} from 'jspdf';
import Swal from 'sweetalert2'; // <-- Importazione di SweetAlert2
import {Pezzo, RisultatoOttimizzazione} from './taglio-pannelli.model';
import {TaglioPannelliService} from './taglio-pannelli.service';
import {CanvasTaglioComponent} from './taglio-pannelli.component';
import {Auth} from '../auth/auth';

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

  // ---> NUOVA VARIABILE PER IL CARICAMENTO <---
  isCalcoloInCorso: boolean = false;
  isGenerazionePdfInCorso: boolean = false;

  private taglioService = inject(TaglioPannelliService);
  private authService = inject(Auth);
  private cdr = inject(ChangeDetectorRef);

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
  esportaPDF() {
    if (!this.risultatoOttimizzazione) return;

    // 1. Salviamo il risultato in una COSTANTE LOCALE prima del timeout.
    // Questo rassicura TypeScript ed elimina l'errore "Object is possibly null"
    const risultato = this.risultatoOttimizzazione;

    // 2. Accendiamo lo spinner del caricamento
    this.isGenerazionePdfInCorso = true;

    // 3. Settiamo un timer per far apparire lo spinner prima del freeze
    setTimeout(() => {
      try {
        const doc = new jsPDF('portrait', 'mm', 'a4');

        // Usiamo la costante "risultato" al posto di "this.risultatoOttimizzazione"
        const pannelli = risultato.pannelli;

        const areaUsata = risultato.areaUsata / 1000000;
        const areaScarto = risultato.areaScarto / 1000000;
        const areaTot = areaUsata + areaScarto;
        const percUsata = ((areaUsata / areaTot) * 100).toFixed(1);
        const percScarto = ((areaScarto / areaTot) * 100).toFixed(1);

        const oggi = new Date().toLocaleDateString('it-IT');
        let paginaNum = 1;

        // Funzione per Header e Footer
        const drawHeaderFooter = (pageNum: number) => {
          doc.setFontSize(10);
          doc.setTextColor(150, 150, 150);
          doc.setFont("helvetica", "normal");
          doc.text(`${oggi}`, 14, 15);
          doc.setFont("helvetica", "bold");
          doc.text('Ligno Suite - Ottimizzazione Taglio', 196, 15, {align: 'right'});
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(`Pagina ${pageNum}`, 105, 290, {align: 'center'});
          doc.setTextColor(0, 0, 0);
        };

        // ==========================================
        // PAGINA 1: RIEPILOGO E LOGO
        // ==========================================
        drawHeaderFooter(paginaNum);

        // --- LOGO FALEGNAMERIA (Dal servizio Auth) ---
        let logoAziendale = null;
        try {
          const utente = this.authService.getUtenteLoggato();
          if (utente && utente.logoBase64) {
            logoAziendale = utente.logoBase64 as string;
          }
        } catch (e) {
          console.error("Errore nella lettura del logo dal servizio Auth", e);
        }

        if (logoAziendale) {
          try {
            let formato = 'JPEG';
            if (logoAziendale.includes('image/png')) formato = 'PNG';
            else if (logoAziendale.includes('image/webp')) formato = 'WEBP';

            const imgProps = doc.getImageProperties(logoAziendale);
            const altezzaFissa = 20;
            const larghezzaProporzionata = (imgProps.width / imgProps.height) * altezzaFissa;

            doc.addImage(logoAziendale, formato, 14, 25, larghezzaProporzionata, altezzaFissa);
          } catch (err) {
            console.error("Errore durante l'inserimento del logo nel PDF", err);
            doc.setDrawColor(200, 200, 200);
            doc.rect(14, 25, 50, 25);
            doc.setFontSize(8);
            doc.text("ERRORE LOGO", 39, 40, {align: 'center'});
          }
        } else {
          doc.setDrawColor(200, 200, 200);
          doc.rect(14, 25, 50, 25);
          doc.setFontSize(8);
          doc.text("LOGO FALEGNAMERIA", 39, 40, {align: 'center'});
        }

        let startY = 65;
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text('RIEPILOGO GLOBALE PROGETTO', 105, startY, {align: 'center'});

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        startY += 12;
        doc.text(`Pannelli utilizzati: ${pannelli.length}`, 14, startY);
        doc.text(`Dimensione pannello: ${this.pannelloAltezza} x ${this.pannelloLarghezza} mm`, 80, startY);

        startY += 8;
        doc.text(`Totale pezzi prodotti: ${this.quantitaTotale}`, 14, startY);
        doc.text(`Spessore lama/taglio: ${this.spessoreLama} mm`, 80, startY);

        startY += 12;
        doc.setFont("helvetica", "bold");
        doc.text(`Efficienza totale: ${percUsata}%`, 14, startY);

        doc.setFont("helvetica", "normal");
        startY += 8;
        doc.text(`Area totale utilizzata: ${areaUsata.toFixed(3)} m²`, 14, startY);
        doc.text(`Area totale scarto: ${areaScarto.toFixed(3)} m² (${percScarto}%)`, 80, startY);

        // --- SEZIONE NOTE ---
        startY = 200;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Note:", 14, startY);

        doc.setDrawColor(180, 180, 180);
        for (let n = 0; n < 6; n++) {
          const lineY = startY + 10 + (n * 10);
          doc.line(14, lineY, 196, lineY);
        }

        // ==========================================
        // PAGINE SUCCESSIVE: PANNELLI
        // ==========================================
        pannelli.forEach((pannello, i) => {
          doc.addPage();
          paginaNum++;
          drawHeaderFooter(paginaNum);

          let pY = 25;
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text(`PANNELLO ${i + 1}`, 14, pY);

          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          pY += 8;

          const areaP = (pannello.pannelloLarghezza * pannello.pannelloAltezza);
          let pAreaUsata = 0;
          pannello.pezzi.forEach((p: any) => pAreaUsata += (p.larghezzaTaglio || 0) * (p.altezzaTaglio || 0));
          const pAreaScarto = areaP - pAreaUsata;

          doc.text(`Area usata: ${(pAreaUsata / 1000000).toFixed(3)} m² (${((pAreaUsata / areaP) * 100).toFixed(1)}%)`, 14, pY);
          doc.text(`Scarto: ${(pAreaScarto / 1000000).toFixed(3)} m² (${((pAreaScarto / areaP) * 100).toFixed(1)}%)`, 80, pY);
          doc.text(`Pezzi ricavati: ${pannello.pezzi.length}`, 145, pY);

          pY += 8;

          // Immagine
          const imgData = this.generaImmaginePannello(pannello);
          if (imgData) {
            const SCALA_IMG = 2.0;
            const PAD_IMG = 40 * SCALA_IMG;
            const origW = pannello.pannelloLarghezza * SCALA_IMG + PAD_IMG * 2;
            const origH = pannello.pannelloAltezza * SCALA_IMG + PAD_IMG * 2;
            const ratio = Math.min(182 / origW, 110 / origH);
            const finalW = origW * ratio;
            const finalH = origH * ratio;

            doc.addImage(imgData, 'PNG', 14, pY, finalW, finalH);
            doc.setDrawColor(200, 200, 200);
            doc.rect(14, pY, finalW, finalH);

            pY += finalH + 12;
          }

          // Tabella Pezzi - Intestazione
          doc.setFont("helvetica", "bold");
          doc.text("Qtà", 14, pY);
          doc.text("Dimensioni (H x L)", 28, pY);
          doc.text("Descrizione", 80, pY);
          doc.line(14, pY + 2, 196, pY + 2);
          doc.setFont("helvetica", "normal");
          pY += 8;

          // Raggruppiamo i pezzi identici
          const pezziRaggruppati: { qta: number; p: any }[] = [];

          pannello.pezzi.forEach((p: any) => {
            const esistente = pezziRaggruppati.find(
              (rp) => rp.p.nome === p.nome &&
                rp.p.altezzaTaglio === p.altezzaTaglio &&
                rp.p.larghezzaTaglio === p.larghezzaTaglio &&
                rp.p.ruotato === p.ruotato
            );

            if (esistente) {
              esistente.qta++;
            } else {
              pezziRaggruppati.push({qta: 1, p: p});
            }
          });

          pezziRaggruppati.sort((a, b) =>
            (b.p.larghezzaTaglio * b.p.altezzaTaglio) - (a.p.larghezzaTaglio * a.p.altezzaTaglio)
          );

          pezziRaggruppati.forEach((gruppo) => {
            if (pY > 275) {
              doc.addPage();
              paginaNum++;
              drawHeaderFooter(paginaNum);
              pY = 25;
              doc.setFont("helvetica", "bold");
              doc.text("Qtà", 14, pY);
              doc.text("Dimensioni (H x L)", 28, pY);
              doc.text("Descrizione", 80, pY);
              doc.line(14, pY + 2, 196, pY + 2);
              doc.setFont("helvetica", "normal");
              pY += 8;
            }

            const rot = gruppo.p.ruotato ? " [Ruotato]" : "";
            doc.text(`${gruppo.qta}x`, 14, pY);
            doc.text(`${gruppo.p.altezzaTaglio} x ${gruppo.p.larghezzaTaglio} mm`, 28, pY);
            doc.text(`${gruppo.p.nome}${rot}`, 80, pY);
            pY += 6;
          });

          if (pannello.scarti && pannello.scarti.length > 0) {
            pY += 4;

            const scartiRaggruppati: { qta: number; s: any }[] = [];
            pannello.scarti.forEach((scarto: any) => {
              const w = Math.round(scarto.w * 10) / 10;
              const h = Math.round(scarto.h * 10) / 10;

              const maxDim = Math.max(w, h);
              const minDim = Math.min(w, h);

              const esistente = scartiRaggruppati.find((rs) => rs.s.w === maxDim && rs.s.h === minDim);

              if (esistente) {
                esistente.qta++;
              } else {
                scartiRaggruppati.push({qta: 1, s: {w: maxDim, h: minDim}});
              }
            });

            scartiRaggruppati.sort((a, b) => (b.s.w * b.s.h) - (a.s.w * a.s.h));

            doc.setFont("helvetica", "italic");
            doc.setTextColor(100, 100, 100);

            scartiRaggruppati.forEach((gruppo) => {
              if (pY > 275) {
                doc.addPage();
                paginaNum++;
                drawHeaderFooter(paginaNum);
                pY = 25;
                doc.setFont("helvetica", "bold");
                doc.setTextColor(0, 0, 0);
                doc.text("Qtà", 14, pY);
                doc.text("Dimensioni (H x L)", 28, pY);
                doc.text("Descrizione", 80, pY);
                doc.line(14, pY + 2, 196, pY + 2);
                pY += 8;
                doc.setFont("helvetica", "italic");
                doc.setTextColor(100, 100, 100);
              }

              const dimW = Number.isInteger(gruppo.s.w) ? gruppo.s.w : gruppo.s.w.toFixed(1);
              const dimH = Number.isInteger(gruppo.s.h) ? gruppo.s.h : gruppo.s.h.toFixed(1);

              doc.text(`${gruppo.qta}x`, 14, pY);
              doc.text(`${dimH} x ${dimW} mm`, 28, pY);
              doc.text(`Rimanenza`, 80, pY);
              pY += 6;
            });

            doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 0, 0);
          }
        });

        doc.save(`Schemi_Taglio_${oggi.replace(/\//g, '-')}.pdf`);

      } catch (error) {
        console.error("Errore durante la generazione del PDF:", error);
        Swal.fire('Errore', 'Si è verificato un errore durante la creazione del PDF.', 'error');
      } finally {
        // 4. A operazione terminata o fallita, spegniamo lo spinner
        this.isGenerazionePdfInCorso = false;
        this.cdr.detectChanges(); // Diciamo ad Angular di aggiornare l'interfaccia istantaneamente
      }
    }, 50);
  }

  // Esporta in CSV
  esportaCSV() {
    // Usiamo il punto e virgola come separatore (Standard per Excel in lingua italiana)
    const separatore = ';';
    let csv = '';

    // --- BLOCCO 1: Impostazioni Generali ---
    csv += 'IMPOSTAZIONI PANNELLO\n';
    csv += `Altezza (mm)${separatore}Larghezza (mm)${separatore}Spessore Lama (mm)${separatore}Margine (mm)\n`;
    csv += `${this.pannelloAltezza}${separatore}${this.pannelloLarghezza}${separatore}${this.spessoreLama}${separatore}${this.marginePannello}\n\n`;

    // --- BLOCCO 2: Distinta dei Pezzi ---
    csv += 'DISTINTA PEZZI\n';
    csv += `Descrizione${separatore}Altezza (mm)${separatore}Larghezza (mm)${separatore}Quantita${separatore}Rotazione\n`;

    this.pezzi.forEach(p => {
      // Traduciamo il booleano in Si / No
      const rotazione = p.puoRuotare ? 'Si' : 'No';

      // Puliamo la descrizione: se l'utente ha inserito dei "a capo" o dei "punti e virgola" nel nome,
      // li sostituiamo per evitare che "rompano" la struttura del file CSV
      let nomePulito = p.nome || '';
      nomePulito = nomePulito.replace(/(\r\n|\n|\r)/gm, " ").replace(/;/g, ",");

      csv += `${nomePulito}${separatore}${p.altezza}${separatore}${p.larghezza}${separatore}${p.quantita}${separatore}${rotazione}\n`;
    });

    // --- CREAZIONE E DOWNLOAD DEL FILE ---
    // \ufeff è il BOM (Byte Order Mark) per UTF-8: suggerisce ad Excel la corretta codifica del testo
    const blob = new Blob(["\ufeff", csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);

    const oggi = new Date().toLocaleDateString('it-IT').replace(/\//g, '-');
    link.setAttribute('download', `Distinta_Taglio_${oggi}.csv`);

    // Aggiunge temporaneamente il link alla pagina, lo clicca e lo rimuove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Libera la memoria
  }

  // Importa i dati da un file CSV
  protected importaCSV() {
    // Creiamo "al volo" un input file nascosto
    const inputNode = document.createElement('input');
    inputNode.type = 'file';
    inputNode.accept = '.csv';

    // Restiamo in ascolto della scelta del file
    inputNode.addEventListener('change', (event: any) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      // Quando il file è stato caricato in memoria dal browser
      reader.onload = (e: any) => {
        try {
          const text = e.target.result;
          this.processaCSV(text);
        } catch (error) {
          Swal.fire('Errore', 'Impossibile leggere il file CSV. Assicurati che sia stato generato dal sistema e non manomesso.', 'error');
        }
      };

      // Avvia la lettura del file come testo
      reader.readAsText(file);
    });

    // Simuliamo il click per aprire la finestra di selezione file di Windows/Mac
    inputNode.click();
  }

  // Motore di elaborazione e conversione testo -> logica
  private processaCSV(csvText: string) {
    // 1. RESET TOTALE DELL'AMBIENTE (come se la pagina fosse ricaricata)
    this.pezzi = [];
    this.risultatoOttimizzazione = null;
    this.indicePannelloAttivo = 0;
    this.zoomImmagine = 30;

    // Rimuoviamo il BOM iniziale (se presente) e dividiamo il file in righe
    let testoPulito = csvText.replace(/^\uFEFF/, '').trim();
    const righe = testoPulito.split(/\r?\n/);

    if (righe.length < 6) {
      throw new Error('Il file non contiene righe sufficienti per essere valido.');
    }

    // 2. RECUPERO IMPOSTAZIONI PANNELLO
    // La riga con i dati è l'indice 2 (0: Titolo blocco, 1: Intestazioni, 2: Dati)
    const datiPannello = righe[2].split(';');
    if (datiPannello.length >= 4) {
      this.pannelloAltezza = Number(datiPannello[0]) || 0;
      this.pannelloLarghezza = Number(datiPannello[1]) || 0;
      this.spessoreLama = Number(datiPannello[2]) || 0;
      this.marginePannello = Number(datiPannello[3]) || 0;

      // Chiamiamo il metodo che aggiorna la tendina su "custom" o sul preset corretto
      this.verificaPresetPersonalizzato();
    }

    // 3. RECUPERO DISTINTA PEZZI
    // Cerchiamo la riga dove iniziano le colonne dei pezzi, per essere resistenti ad eventuali spazi vuoti
    let startIndexPezzi = 6;
    for (let i = 0; i < righe.length; i++) {
      if (righe[i].startsWith('Descrizione;Altezza')) {
        startIndexPezzi = i + 1; // I dati iniziano alla riga successiva
        break;
      }
    }

    // Cicliamo e importiamo i pezzi
    for (let i = startIndexPezzi; i < righe.length; i++) {
      const riga = righe[i].trim();
      if (!riga) continue; // Salta righe vuote a fine file

      const colonne = riga.split(';');
      if (colonne.length >= 5) {
        this.pezzi.push({
          nome: colonne[0],
          altezza: Number(colonne[1]) || 0,
          larghezza: Number(colonne[2]) || 0,
          quantita: Number(colonne[3]) || 1,
          puoRuotare: colonne[4].trim().toLowerCase() === 'si'
        });
      }
    }

    // 4. FEEDBACK UTENTE
    Swal.fire({
      title: 'Distinta Importata!',
      text: `Configurazione caricata e ${this.pezzi.length} pezzi aggiunti in lista.`,
      icon: 'success',
      confirmButtonColor: '#212529',
      timer: 1000,
      showConfirmButton: false
    });

    // Avvisa Angular di aggiornare l'interfaccia istantaneamente
    this.cdr.detectChanges();
  }

  private generaImmaginePannello(pannello: any): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Portiamo la scala a 4.0 per generare un'immagine in 4K/Altissima risoluzione
    const SCALA = 2.0;
    const PAD = 40 * SCALA; // Scaliamo anche il padding
    const W = pannello.pannelloLarghezza * SCALA;
    const H = pannello.pannelloAltezza * SCALA;

    canvas.width = W + PAD * 2;
    canvas.height = H + PAD * 2;

    ctx.translate(PAD, PAD);

    // 1. Pannello Grezzo
    ctx.fillStyle = 'rgb(250, 249, 246)';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 3 * SCALA; // Scaliamo lo spessore del bordo
    ctx.strokeRect(0, 0, W, H);

    // 2. DISEGNO DEGLI SCARTI
    if (pannello.scarti && pannello.scarti.length > 0) {
      pannello.scarti.forEach((s: any) => {
        const sx = (s.x || 0) * SCALA;
        const sy = (s.y || 0) * SCALA;
        const sw = (s.w || 0) * SCALA;
        const sh = (s.h || 0) * SCALA;

        ctx.fillStyle = 'rgba(220, 220, 220, 0.6)';
        ctx.fillRect(sx, sy, sw, sh);

        ctx.strokeStyle = 'gray';
        ctx.lineWidth = 1 * SCALA; // Spessore tratteggio
        ctx.setLineDash([5 * SCALA, 5 * SCALA]); // Scaliamo anche la lunghezza dei tratti
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.setLineDash([]);

        ctx.fillStyle = '#404040';
        const fontSizeScarto = 12 * SCALA; // Font ad alta risoluzione
        ctx.font = `italic ${fontSizeScarto}px Arial`;

        const dimW = Number.isInteger(s.w) ? s.w : s.w.toFixed(1);
        const dimH = Number.isInteger(s.h) ? s.h : s.h.toFixed(1);
        const testoS = `Scarto ${dimW}x${dimH}`;
        const testoWidth = ctx.measureText(testoS).width;

        if (sw > testoWidth + (5 * SCALA) && sh > (15 * SCALA)) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(testoS, sx + (5 * SCALA), sy + (5 * SCALA));
        }
      });
    }

    // 3. Pezzi
    ctx.lineWidth = 1 * SCALA;
    pannello.pezzi.forEach((p: any) => {
      const px = (p.x || 0) * SCALA;
      const py = (p.y || 0) * SCALA;
      const pw = (p.larghezzaTaglio || 0) * SCALA;
      const ph = (p.altezzaTaglio || 0) * SCALA;

      ctx.fillStyle = 'rgba(173, 216, 230, 0.78)';
      ctx.fillRect(px, py, pw, ph);

      ctx.strokeStyle = 'rgb(0, 102, 204)';
      ctx.strokeRect(px, py, pw, ph);

      ctx.fillStyle = '#000000';
      const title = (p.ruotato ? '↺ ' : '') + p.nome;
      const dimensions = `${p.altezzaTaglio} x ${p.larghezzaTaglio}`;

      const fontTitleSize = 14 * SCALA; // Font ad alta risoluzione
      const fontDimSize = 14 * SCALA;

      ctx.font = `bold ${fontTitleSize}px Arial`;
      const titleWidth = ctx.measureText(title).width;

      ctx.font = `${fontDimSize}px Arial`;
      const dimWidth = ctx.measureText(dimensions).width;

      if (pw > Math.max(titleWidth, dimWidth) + (10 * SCALA) && ph > (34 * SCALA)) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = `bold ${fontTitleSize}px Arial`;
        ctx.fillText(title, px + pw / 2, py + ph / 2 - (6 * SCALA));

        ctx.font = `${fontDimSize}px Arial`;
        ctx.fillText(dimensions, px + pw / 2, py + ph / 2 + (8 * SCALA));
      } else if (pw > titleWidth + (5 * SCALA) && ph > (18 * SCALA)) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = `bold ${fontTitleSize}px Arial`;
        ctx.fillText(title, px + (5 * SCALA), py + (5 * SCALA));
      }
    });

    return canvas.toDataURL('image/png');
  }
}
