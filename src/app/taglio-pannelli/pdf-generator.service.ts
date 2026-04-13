import {Injectable} from '@angular/core';
import {jsPDF} from 'jspdf';
import {RisultatoOttimizzazione} from './taglio-pannelli.model';

/**
 * Interfaccia per raccogliere i dati di configurazione necessari alla stampa
 */
export interface ConfigurazionePdf {
  pannelloAltezza: number;
  pannelloLarghezza: number;
  spessoreLama: number;
  quantitaTotale: number;
}

@Injectable({
  providedIn: 'root'
})
export class PdfGeneratorService {

  /**
   * Genera e fa scaricare il PDF con gli schemi di taglio.
   * Restituisce una Promise per permettere al componente di gestire lo spinner di caricamento.
   * * @param risultato I dati di ottimizzazione calcolati da ASP
   * @param config Le impostazioni del pannello e le quantità
   * @param logoBase64 (Opzionale) Il logo dell'azienda in formato Base64
   */
  public async generaEScaricaPDF(risultato: RisultatoOttimizzazione, config: ConfigurazionePdf, logoBase64?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Usiamo setTimeout per non bloccare il thread UI principale (permette allo spinner di girare)
      setTimeout(() => {
        try {
          const doc = new jsPDF('portrait', 'mm', 'a4');
          const pannelli = risultato.pannelli;

          // Calcoli Efficienza
          const areaUsata = risultato.areaUsata / 1000000;
          const areaScarto = risultato.areaScarto / 1000000;
          const areaTot = areaUsata + areaScarto;
          const percUsata = ((areaUsata / areaTot) * 100).toFixed(1);
          const percScarto = ((areaScarto / areaTot) * 100).toFixed(1);

          const oggi = new Date().toLocaleDateString('it-IT');
          let paginaNum = 1;

          // Funzione interna per Header e Footer
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

          if (logoBase64) {
            try {
              let formato = 'JPEG';
              if (logoBase64.includes('image/png')) formato = 'PNG';
              else if (logoBase64.includes('image/webp')) formato = 'WEBP';

              const imgProps = doc.getImageProperties(logoBase64);
              const altezzaFissa = 20;
              const larghezzaProporzionata = (imgProps.width / imgProps.height) * altezzaFissa;

              doc.addImage(logoBase64, formato, 14, 25, larghezzaProporzionata, altezzaFissa);
            } catch (err) {
              console.error("Errore durante l'inserimento del logo nel PDF", err);
              this.disegnaBoxLogoFallback(doc);
            }
          } else {
            this.disegnaBoxLogoFallback(doc);
          }

          // Testi Riepilogo
          let startY = 65;
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          doc.text('RIEPILOGO GLOBALE PROGETTO', 105, startY, {align: 'center'});

          doc.setFontSize(11);
          doc.setFont("helvetica", "normal");
          startY += 12;
          doc.text(`Pannelli utilizzati: ${pannelli.length}`, 14, startY);
          doc.text(`Dimensione pannello: ${config.pannelloAltezza} x ${config.pannelloLarghezza} mm`, 80, startY);

          startY += 8;
          doc.text(`Totale pezzi prodotti: ${config.quantitaTotale}`, 14, startY);
          doc.text(`Spessore lama/taglio: ${config.spessoreLama} mm`, 80, startY);

          startY += 12;
          doc.setFont("helvetica", "bold");
          doc.text(`Efficienza totale: ${percUsata}%`, 14, startY);

          doc.setFont("helvetica", "normal");
          startY += 8;
          doc.text(`Area totale utilizzata: ${areaUsata.toFixed(3)} m²`, 14, startY);
          doc.text(`Area totale scarto: ${areaScarto.toFixed(3)} m² (${percScarto}%)`, 80, startY);

          // Sezione Note
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
          // PAGINE SUCCESSIVE: DETTAGLIO PANNELLI
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

            // Disegno Immagine Canvas
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

            // Tabella Pezzi
            doc.setFont("helvetica", "bold");
            doc.text("Qtà", 14, pY);
            doc.text("Dimensioni (H x L)", 28, pY);
            doc.text("Descrizione", 80, pY);
            doc.line(14, pY + 2, 196, pY + 2);
            doc.setFont("helvetica", "normal");
            pY += 8;

            // Raggruppamento pezzi identici
            const pezziRaggruppati: { qta: number; p: any }[] = [];
            pannello.pezzi.forEach((p: any) => {
              const esistente = pezziRaggruppati.find(
                (rp) => rp.p.nome === p.nome && rp.p.altezzaTaglio === p.altezzaTaglio && rp.p.larghezzaTaglio === p.larghezzaTaglio && rp.p.ruotato === p.ruotato
              );
              if (esistente) esistente.qta++;
              else pezziRaggruppati.push({qta: 1, p: p});
            });

            pezziRaggruppati.sort((a, b) => (b.p.larghezzaTaglio * b.p.altezzaTaglio) - (a.p.larghezzaTaglio * a.p.altezzaTaglio));

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

            // Tabella Scarti/Sfridi
            if (pannello.scarti && pannello.scarti.length > 0) {
              pY += 4;
              const scartiRaggruppati: { qta: number; s: any }[] = [];
              pannello.scarti.forEach((scarto: any) => {
                const w = Math.round(scarto.w * 10) / 10;
                const h = Math.round(scarto.h * 10) / 10;
                const maxDim = Math.max(w, h);
                const minDim = Math.min(w, h);
                const esistente = scartiRaggruppati.find((rs) => rs.s.w === maxDim && rs.s.h === minDim);
                if (esistente) esistente.qta++;
                else scartiRaggruppati.push({qta: 1, s: {w: maxDim, h: minDim}});
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

          // Download
          doc.save(`Schemi_Taglio_${oggi.replace(/\//g, '-')}.pdf`);
          resolve();

        } catch (error) {
          reject(error);
        }
      }, 50); // Timeout per permettere l'aggiornamento UI
    });
  }

  /**
   * Disegna il rettangolo grigio di fallback se il logo manca o è corrotto
   */
  private disegnaBoxLogoFallback(doc: jsPDF): void {
    doc.setDrawColor(200, 200, 200);
    doc.rect(14, 25, 50, 25);
    doc.setFontSize(8);
    doc.text("LOGO FALEGNAMERIA", 39, 40, {align: 'center'});
  }

  /**
   * Genera in memoria l'immagine Canvas 2D per il PDF
   */
  private generaImmaginePannello(pannello: any): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const SCALA = 2.0;
    const PAD = 40 * SCALA;
    const W = pannello.pannelloLarghezza * SCALA;
    const H = pannello.pannelloAltezza * SCALA;

    canvas.width = W + PAD * 2;
    canvas.height = H + PAD * 2;

    ctx.translate(PAD, PAD);

    // Pannello Grezzo
    ctx.fillStyle = 'rgb(250, 249, 246)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 3 * SCALA;
    ctx.strokeRect(0, 0, W, H);

    // Scarti
    if (pannello.scarti && pannello.scarti.length > 0) {
      pannello.scarti.forEach((s: any) => {
        const sx = (s.x || 0) * SCALA;
        const sy = (s.y || 0) * SCALA;
        const sw = (s.w || 0) * SCALA;
        const sh = (s.h || 0) * SCALA;

        ctx.fillStyle = 'rgba(220, 220, 220, 0.6)';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = 'gray';
        ctx.lineWidth = 1 * SCALA;
        ctx.setLineDash([5 * SCALA, 5 * SCALA]);
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.setLineDash([]);

        ctx.fillStyle = '#404040';
        const fontSizeScarto = 12 * SCALA;
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

    // Pezzi
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
      const fontTitleSize = 14 * SCALA;
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
