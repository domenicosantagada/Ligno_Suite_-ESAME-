import {Component, ElementRef, Input, OnChanges, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RisultatoPannello} from './taglio-pannelli.model';

@Component({
  selector: 'app-canvas-taglio',
  standalone: true,
  imports: [CommonModule],
  template: `
    <canvas #panelCanvas></canvas>`
})
export class CanvasTaglioComponent implements OnChanges {
  @ViewChild('panelCanvas', {static: true}) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() pannello!: RisultatoPannello;
  @Input() zoom: number = 30;
  @Input() indicePannello: number = 0;
  @Input() colori: string[] = [];

  ngOnChanges() {
    if (this.pannello) {
      this.disegna();
    }
  }

  disegna() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SCALA = this.zoom / 100;
    const PAD = 20;
    const W = this.pannello.pannelloLarghezza * SCALA;
    const H = this.pannello.pannelloAltezza * SCALA;

    canvas.width = W + PAD * 2;
    canvas.height = H + PAD * 2;

    // Sfondo della tela bianco puro
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sfondo del pannello (Grigio chiarissimo)
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(PAD, PAD, W, H);

    // Bordo del pannello principale
    ctx.strokeStyle = "#212529";
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, PAD, W, H);

    // Disegna tutti i pezzi
    this.pannello.pezzi.forEach((p) => {
      const px = PAD + (p.x || 0) * SCALA;
      const py = PAD + (p.y || 0) * SCALA;
      const pw = (p.larghezzaTaglio || 0) * SCALA;
      const ph = (p.altezzaTaglio || 0) * SCALA;

      const cIndex = p.indiceColore !== undefined ? Number(p.indiceColore) : 0;
      const colore = this.colori[cIndex % this.colori.length];

      // Colore del pezzo
      ctx.fillStyle = colore;
      ctx.fillRect(px, py, pw, ph);

      // Bordo del pezzo
      ctx.strokeStyle = "#343a40";
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pw, ph);

      // Etichette testo
      if (pw > 30 && ph > 18) {
        ctx.fillStyle = "#212529";
        ctx.font = `600 ${Math.max(9, Math.min(14, pw / 5))}px 'Inter', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const etichetta = p.ruotato ? `↺ ${p.nome}` : p.nome;
        ctx.fillText(etichetta, px + pw / 2, py + ph / 2);

        if (pw > 60 && ph > 35) {
          ctx.font = `400 ${Math.max(8, Math.min(11, pw / 8))}px 'Inter', sans-serif`;
          ctx.fillStyle = "#495057";
          // Qui stampiamo prima l'Altezza e poi la Larghezza
          ctx.fillText(`${p.altezzaTaglio} × ${p.larghezzaTaglio}`, px + pw / 2, py + ph / 2 + 15);
        }
      }
    });

    // Etichetta pannello in alto a sinistra (Alt x Larg)
    ctx.fillStyle = "#212529";
    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`PANNELLO ${this.indicePannello + 1}  •  ${this.pannello.pannelloAltezza} x ${this.pannello.pannelloLarghezza} mm`, PAD, PAD - 6);
  }
}
