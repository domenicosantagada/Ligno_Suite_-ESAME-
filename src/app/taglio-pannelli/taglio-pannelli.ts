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
        const SCALA = 0.5;
        const PAD = 20;
        const origW = pannello.pannelloLarghezza * SCALA + PAD * 2;
        const origH = pannello.pannelloAltezza * SCALA + PAD * 2;
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

  private generaImmaginePannello(pannello: any): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const SCALA = 0.5;
    const PAD = 20;
    const W = pannello.pannelloLarghezza * SCALA;
    const H = pannello.pannelloAltezza * SCALA;

    canvas.width = W + PAD * 2;
    canvas.height = H + PAD * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, PAD, W, H);

    pannello.pezzi.forEach((p: any) => {
      const px = PAD + (p.x || 0) * SCALA;
      const py = PAD + (p.y || 0) * SCALA;
      const pw = (p.larghezzaTaglio || 0) * SCALA;
      const ph = (p.altezzaTaglio || 0) * SCALA;

      const cIndex = p.indiceColore !== undefined ? Number(p.indiceColore) : 0;
      ctx.fillStyle = this.COLORI_PEZZI[cIndex % this.COLORI_PEZZI.length];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(px, py, pw, ph);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px, py, pw, ph);

      if (pw > 30 && ph > 18) {
        ctx.fillStyle = "#1f2937";
        ctx.font = `bold ${Math.max(10, Math.min(18, pw / 5))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.ruotato ? `↺ ${p.nome}` : p.nome, px + pw / 2, py + ph / 2);
        if (pw > 50 && ph > 30) {
          ctx.font = `${Math.max(8, Math.min(12, pw / 8))}px sans-serif`;
          ctx.fillStyle = "rgba(31,41,55,0.7)";
          ctx.fillText(`${p.altezzaTaglio} × ${p.larghezzaTaglio}`, px + pw / 2, py + ph / 2 + 16);
        }
      }
    });

    return canvas.toDataURL('image/png');
  }
}
