import {Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {jsPDF} from 'jspdf';
import Swal from 'sweetalert2'; // <-- Importazione di SweetAlert2
import {Pezzo, RisultatoOttimizzazione} from './taglio-pannelli.model';
import {TaglioPannelliService} from './taglio-pannelli.service';
import {CanvasTaglioComponent} from './taglio-pannelli.component';

@Component({
  selector: 'app-taglio-pannelli',
  standalone: true,
  imports: [CommonModule, FormsModule, CanvasTaglioComponent],
  templateUrl: './taglio-pannelli.html',
  styleUrls: ['./taglio-pannelli.css']
})
export class TaglioPannelli {

  schedaAttiva: 'input' | 'risultato' = 'input';

  readonly COLORI_PEZZI = [
    "#0d6efd", "#6ea8fe", "#0dcaf0", "#9eeaf9", "#198754",
    "#a3cfbb", "#ffc107", "#ffe69c", "#fd7e14", "#ffc299",
    "#dc3545", "#ea868f", "#6610f2", "#c5b3e6", "#d63384"
  ];

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

  private taglioService = inject(TaglioPannelliService);

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

  zoomIn() {
    if (this.zoomImmagine < 100) this.zoomImmagine += 5;
  }

  zoomOut() {
    if (this.zoomImmagine > 10) this.zoomImmagine -= 5;
  }

  calcolaTaglio() {
    // Filtriamo i pezzi per assicurarci che abbiano misure e quantità valide
    const pezziValidi = this.pezzi.filter(p => p.larghezza > 0 && p.altezza > 0 && p.quantita > 0);

    // BLOCCO ANTI-BUG: Controllo con popup SweetAlert2 standard (identico a quello dei preventivi)
    if (pezziValidi.length === 0) {
      Swal.fire('Attenzione', 'Inserisci almeno un pezzo nella distinta con dimensioni e quantità valide prima di calcolare l\'ottimizzazione.', 'warning');
      this.risultatoOttimizzazione = null; // Resetta eventuali calcoli precedenti
      return;
    }

    // Se ci sono pezzi validi, calcola:
    this.risultatoOttimizzazione = this.taglioService.ottimizzaTaglio(
      this.pannelloLarghezza, this.pannelloAltezza, this.spessoreLama, this.marginePannello, pezziValidi
    );
    this.indicePannelloAttivo = 0;
    this.cambiaScheda('risultato');
  }

  // --- ESPORTAZIONE PDF ---
  esportaPDF() {
    if (!this.risultatoOttimizzazione) return;

    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pannelli = this.risultatoOttimizzazione.pannelli;

    const areaUsata = this.risultatoOttimizzazione.areaUsata / 1000000;
    const areaScarto = this.risultatoOttimizzazione.areaScarto / 1000000;
    const areaTot = areaUsata + areaScarto;
    const percUsata = ((areaUsata / areaTot) * 100).toFixed(1);
    const percScarto = ((areaScarto / areaTot) * 100).toFixed(1);

    const oggi = new Date().toLocaleDateString('it-IT');
    let paginaNum = 1;

    pannelli.forEach((pannello, i) => {
      if (i > 0) {
        doc.addPage();
        paginaNum++;
      }

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`${oggi}`, 14, 15);
      doc.setFont("helvetica", "bold");
      doc.text('Ligno Suite - Ottimizzazione Taglio', 196, 15, {align: 'right'});

      let startY = 25;

      if (i === 0) {
        doc.setFontSize(14);
        doc.setTextColor(31, 41, 55);
        doc.text('RIEPILOGO GLOBALE PROGETTO', 14, startY);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        startY += 8;
        doc.text(`Pannelli utilizzati: ${pannelli.length} (Misura: ${this.pannelloAltezza} x ${this.pannelloLarghezza} mm)`, 14, startY);
        doc.text(`Spessore lama/taglio: ${this.spessoreLama} mm`, 120, startY);

        startY += 6;
        doc.text(`Totale area utilizzata: ${areaUsata.toFixed(3)} m² (${percUsata}%)`, 14, startY);
        doc.text(`Totale area avanzata: ${areaScarto.toFixed(3)} m² (${percScarto}%)`, 120, startY);

        startY += 8;
        doc.setDrawColor(200, 200, 200);
        doc.line(14, startY, 196, startY);
        startY += 10;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`PANNELLO ${i + 1}`, 14, startY);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      startY += 8;

      const areaP = (pannello.pannelloLarghezza * pannello.pannelloAltezza);
      let pAreaUsata = 0;
      pannello.pezzi.forEach(p => pAreaUsata += (p.larghezzaTaglio || 0) * (p.altezzaTaglio || 0));
      const pAreaScarto = areaP - pAreaUsata;

      doc.text(`Area usata: ${(pAreaUsata / 1000000).toFixed(3)} m² (${((pAreaUsata / areaP) * 100).toFixed(1)}%)`, 14, startY);
      doc.text(`Scarto: ${(pAreaScarto / 1000000).toFixed(3)} m² (${((pAreaScarto / areaP) * 100).toFixed(1)}%)`, 120, startY);
      startY += 6;
      doc.text(`Pezzi ricavati: ${pannello.pezzi.length}`, 14, startY);
      startY += 10;

      const imgData = this.generaImmaginePannello(pannello);
      if (imgData) {
        // Questi valori DEVONO corrispondere a quelli usati in generaImmaginePannello
        const SCALA_IMG = 1.0;
        const PAD_IMG = 40;
        const origW = pannello.pannelloLarghezza * SCALA_IMG + PAD_IMG * 2;
        const origH = pannello.pannelloAltezza * SCALA_IMG + PAD_IMG * 2;

        const ratio = Math.min(182 / origW, 110 / origH);
        const finalW = origW * ratio;
        const finalH = origH * ratio;

        doc.addImage(imgData, 'PNG', 14, startY, finalW, finalH);
        doc.setDrawColor(200, 200, 200);
        doc.rect(14, startY, finalW, finalH);
        startY += finalH + 12;
      }

      doc.setFont("helvetica", "bold");
      doc.text("Qtà | Dimensioni (H x L) | Descrizione", 14, startY);
      doc.line(14, startY + 2, 196, startY + 2);
      doc.setFont("helvetica", "normal");
      startY += 8;

      let currentX = 14;
      const pezziOrdinati = [...pannello.pezzi].sort((a, b) => (b.larghezzaTaglio! * b.altezzaTaglio!) - (a.larghezzaTaglio! * a.altezzaTaglio!));

      pezziOrdinati.forEach((p) => {
        if (startY > 280) {
          doc.addPage();
          paginaNum++;
          startY = 20;
          currentX = 14;
        }
        const rot = p.ruotato ? " [Ruotato]" : "";
        doc.text(`1x   ${p.altezzaTaglio} x ${p.larghezzaTaglio} mm   -   ${p.nome} ${rot}`, currentX, startY);
        currentX += 95;
        if (currentX > 150) {
          currentX = 14;
          startY += 6;
        }
      });

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Pagina ${paginaNum}`, 105, 290, {align: 'center'});
    });

    doc.save(`Schemi_Taglio_${oggi.replace(/\//g, '-')}.pdf`);
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
    this.risultatoOttimizzazione = null; // Azzera eventuali layout calcolati
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
      confirmButtonColor: '#212529', // Stile bottone dark per conformità grafica
      timer: 2500, // Si chiude da solo dopo 2.5 secondi
      showConfirmButton: false
    });
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
