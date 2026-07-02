import {AfterViewInit, Component, ElementRef, HostListener, Input, OnChanges, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RisultatoPannello} from './taglio-pannelli.model';

@Component({
  selector: 'app-canvas-taglio',
  standalone: true,
  imports: [CommonModule],
  // Il canvas occupa interamente lo spazio disponibile del contenitore
  template: `
    <canvas #panelCanvas style="width: 100%; height: 100%; display: block;"></canvas>`
})
export class CanvasTaglioComponent implements OnChanges, AfterViewInit {

  @ViewChild('panelCanvas', {static: true})
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() pannello!: RisultatoPannello;
  @Input() indicePannello: number = 0;

  // Stato della trasformazione grafica (zoom + traslazione)
  private zoomFactor = 1.0;
  private translateX = 0.0;
  private translateY = 0.0;

  // Stato del drag per il panning
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  ngOnChanges() {
    if (this.pannello) {
      // Reset della vista quando cambia il pannello visualizzato
      this.zoomFactor = 1.0;
      this.translateX = 0.0;
      this.translateY = 0.0;

      // Esecuzione differita per garantire dimensioni corrette del canvas
      setTimeout(() => this.resizeCanvasAndDraw(), 0);
    }
  }

  ngAfterViewInit() {
    this.resizeCanvasAndDraw();

    // Adegua il canvas ai cambi di dimensione della finestra
    window.addEventListener('resize', () => this.resizeCanvasAndDraw());
  }

  // -----------------------------
  // Gestione interazioni utente
  // -----------------------------

  @HostListener('wheel', ['$event'])
  onWheel(e: WheelEvent) {
    e.preventDefault(); // evita lo scroll della pagina

    const oldZoom = this.zoomFactor;

    // Zoom incrementale
    if (e.deltaY < 0) {
      this.zoomFactor *= 1.15;
    } else {
      this.zoomFactor /= 1.15;
    }

    // Clamp del livello di zoom per evitare valori estremi
    this.zoomFactor = Math.max(0.1, Math.min(this.zoomFactor, 50.0));

    const scaleChange = this.zoomFactor / oldZoom;

    // Coordinate del mouse relative al canvas (considerando offset grafico)
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - 40;
    const mouseY = e.clientY - rect.top - 40;

    // Mantiene il punto sotto il cursore stabile durante lo zoom
    this.translateX = mouseX - (mouseX - this.translateX) * scaleChange;
    this.translateY = mouseY - (mouseY - this.translateY) * scaleChange;

    this.disegna();
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: MouseEvent) {
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.canvasRef.nativeElement.style.cursor = 'move';
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (this.isDragging) {
      // Calcolo delta movimento per il panning
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      this.translateX += dx;
      this.translateY += dy;

      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      this.disegna();
    } else {
      this.canvasRef.nativeElement.style.cursor = 'crosshair';
    }
  }

  @HostListener('mouseup')
  @HostListener('mouseleave')
  onMouseUp() {
    this.isDragging = false;
    this.canvasRef.nativeElement.style.cursor = 'crosshair';
  }

  @HostListener('dblclick')
  onDoubleClick() {
    // Reset completo della vista
    this.zoomFactor = 1.0;
    this.translateX = 0.0;
    this.translateY = 0.0;

    this.disegna();
  }

  // -----------------------------
  // Rendering canvas
  // -----------------------------

  disegna() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx || !this.pannello) return;

    // Pulizia completa del canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const stockWidth = this.pannello.pannelloLarghezza;
    const stockHeight = this.pannello.pannelloAltezza;

    // Calcolo scala base per adattare il pannello al canvas
    const scaleX = (canvas.width - 80) / stockWidth;
    const scaleY = (canvas.height - 80) / stockHeight;
    const baseScale = Math.min(scaleX, scaleY);
    const scale = baseScale * this.zoomFactor;

    ctx.save();

    // Traslazione iniziale (margine) + trasformazione utente
    ctx.translate(this.translateX + 40, this.translateY + 40);

    // -----------------------------
    // 1. Pannello base
    // -----------------------------
    const drawStockW = stockWidth * scale;
    const drawStockH = stockHeight * scale;

    ctx.fillStyle = 'rgb(250, 249, 246)';
    ctx.fillRect(0, 0, drawStockW, drawStockH);

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, drawStockW, drawStockH);

    // -----------------------------
    // 2. Scarti
    // -----------------------------
    if (this.pannello.scarti && this.pannello.scarti.length > 0) {
      this.pannello.scarti.forEach((s) => {
        const sx = (s.x || 0) * scale;
        const sy = (s.y || 0) * scale;
        const sw = (s.w || 0) * scale;
        const sh = (s.h || 0) * scale;

        ctx.fillStyle = 'rgba(220, 220, 220, 0.6)';
        ctx.fillRect(sx, sy, sw, sh);

        ctx.strokeStyle = 'gray';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // CREA IL TRATTEGGIO! (5px linea, 5px spazio)
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.setLineDash([]); // RESETTA IL TRATTEGGIO (FONDAMENTALE per non tratteggiare i pezzi normali)

        // Testo Scarto: Corsivo, Grigio scuro
        ctx.fillStyle = '#404040';
        ctx.font = 'italic 10px Arial';

        // Formatta a 1 decimale se ci sono virgole per evitare testi troppo lunghi
        const dimW = Number.isInteger(s.w) ? s.w : s.w.toFixed(1);
        const dimH = Number.isInteger(s.h) ? s.h : s.h.toFixed(1);
        const testoS = `Scarto ${dimW}x${dimH}`;

        // Misura se il testo ci entra nel rettangolo
        const testoWidth = ctx.measureText(testoS).width;

        if (sw > testoWidth + 5 && sh > 15) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(testoS, sx + 5, sy + 5);
        }
      });
    }

    // -----------------------------
    // 3. Pezzi lavorati
    // -----------------------------
    ctx.lineWidth = 1;

    this.pannello.pezzi.forEach((p) => {
      const px = (p.x || 0) * scale;
      const py = (p.y || 0) * scale;
      const pw = (p.larghezzaTaglio || 0) * scale;
      const ph = (p.altezzaTaglio || 0) * scale;

      ctx.fillStyle = 'rgba(173, 216, 230, 0.78)';
      ctx.fillRect(px, py, pw, ph);

      ctx.strokeStyle = 'rgb(0, 102, 204)';
      ctx.strokeRect(px, py, pw, ph);

      ctx.fillStyle = '#000000';

      const title = (p.ruotato ? '↺ ' : '') + p.nome;
      const dimensions = `${p.altezzaTaglio} x ${p.larghezzaTaglio}`;

      ctx.font = 'bold 12px Arial';
      const titleWidth = ctx.measureText(title).width;

      ctx.font = '12px Arial';
      const dimWidth = ctx.measureText(dimensions).width;

      // Posizionamento testo adattivo in base allo spazio disponibile
      if (pw > Math.max(titleWidth, dimWidth) + 10 && ph > 34) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = 'bold 12px Arial';
        ctx.fillText(title, px + pw / 2, py + ph / 2 - 6);

        ctx.font = '12px Arial';
        ctx.fillText(dimensions, px + pw / 2, py + ph / 2 + 8);

      } else if (pw > titleWidth + 5 && ph > 18) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.font = 'bold 12px Arial';
        ctx.fillText(title, px + 5, py + 5);
      }
    });

    ctx.restore();
  }

  /**
   * Sincronizza la risoluzione del canvas con le dimensioni effettive del contenitore
   * e forza un nuovo rendering.
   */
  private resizeCanvasAndDraw() {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;

    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      this.disegna();
    }
  }
}
