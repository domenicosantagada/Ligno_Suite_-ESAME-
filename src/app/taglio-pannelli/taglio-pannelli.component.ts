import {AfterViewInit, Component, ElementRef, HostListener, Input, OnChanges, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RisultatoPannello} from './taglio-pannelli.model';

@Component({
  selector: 'app-canvas-taglio',
  standalone: true,
  imports: [CommonModule],
  // Il canvas ora occupa il 100% dello spazio disponibile nel container
  template: `
    <canvas #panelCanvas style="width: 100%; height: 100%; display: block;"></canvas>`
})
export class CanvasTaglioComponent implements OnChanges, AfterViewInit {
  @ViewChild('panelCanvas', {static: true}) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() pannello!: RisultatoPannello;
  @Input() indicePannello: number = 0;

  // Variabili di stato per la vista (come in Java)
  private zoomFactor = 1.0;
  private translateX = 0.0;
  private translateY = 0.0;

  // Variabili per il Drag (Panning)
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  ngOnChanges() {
    if (this.pannello) {
      // Quando cambia il pannello, resettiamo la vista e ridisegniamo
      this.zoomFactor = 1.0;
      this.translateX = 0.0;
      this.translateY = 0.0;
      // Ritardiamo leggermente per assicurarci che il contenitore abbia le dimensioni corrette
      setTimeout(() => this.resizeCanvasAndDraw(), 0);
    }
  }

  ngAfterViewInit() {
    this.resizeCanvasAndDraw();
    // Se la finestra cambia dimensione, riadattiamo il canvas
    window.addEventListener('resize', () => this.resizeCanvasAndDraw());
  }

  @HostListener('wheel', ['$event'])
  onWheel(e: WheelEvent) {
    e.preventDefault(); // Evita che la pagina scorra
    const oldZoom = this.zoomFactor;

    if (e.deltaY < 0) {
      this.zoomFactor *= 1.15;
    } else {
      this.zoomFactor /= 1.15;
    }
    this.zoomFactor = Math.max(0.1, Math.min(this.zoomFactor, 50.0));

    const scaleChange = this.zoomFactor / oldZoom;

    // Calcolo della posizione del mouse rispetto al canvas (offset di 40px come in Java)
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - 40;
    const mouseY = e.clientY - rect.top - 40;

    this.translateX = mouseX - (mouseX - this.translateX) * scaleChange;
    this.translateY = mouseY - (mouseY - this.translateY) * scaleChange;

    this.disegna();
  }

  // --- GESTIONE EVENTI MOUSE ---

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
    this.zoomFactor = 1.0;
    this.translateX = 0.0;
    this.translateY = 0.0;
    this.disegna();
  }

  disegna() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.pannello) return;

    // 0. Pulizia del Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const stockWidth = this.pannello.pannelloLarghezza;
    const stockHeight = this.pannello.pannelloAltezza;

    // Calcolo Scala base
    const scaleX = (canvas.width - 80) / stockWidth;
    const scaleY = (canvas.height - 80) / stockHeight;
    const baseScale = Math.min(scaleX, scaleY);
    const scale = baseScale * this.zoomFactor;

    ctx.save();
    // Traslazione base (40px) + Panning utente
    ctx.translate(this.translateX + 40, this.translateY + 40);

    // 1. Pannello Grezzo (Background + Bordo)
    const drawStockW = stockWidth * scale;
    const drawStockH = stockHeight * scale;

    ctx.fillStyle = 'rgb(250, 249, 246)'; // Stesso colore Java
    ctx.fillRect(0, 0, drawStockW, drawStockH);

    ctx.strokeStyle = '#333333'; // Color.DARK_GRAY
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, drawStockW, drawStockH);

    // 2. Pezzi (Placed Panels)
    ctx.lineWidth = 1;
    this.pannello.pezzi.forEach((p) => {
      const px = (p.x || 0) * scale;
      const py = (p.y || 0) * scale;
      const pw = (p.larghezzaTaglio || 0) * scale;
      const ph = (p.altezzaTaglio || 0) * scale;

      // Colore riempimento: new Color(173, 216, 230, 200) -> rgba(173, 216, 230, 0.78)
      ctx.fillStyle = 'rgba(173, 216, 230, 0.78)';
      ctx.fillRect(px, py, pw, ph);

      // Colore bordo: new Color(0, 102, 204)
      ctx.strokeStyle = 'rgb(0, 102, 204)';
      ctx.strokeRect(px, py, pw, ph);

      // 3. Testi
      ctx.fillStyle = '#000000';
      const title = (p.ruotato ? '↺ ' : '') + p.nome;
      const dimensions = `${p.altezzaTaglio} x ${p.larghezzaTaglio}`;

      ctx.font = 'bold 12px Arial';
      const titleWidth = ctx.measureText(title).width;

      ctx.font = '12px Arial';
      const dimWidth = ctx.measureText(dimensions).width;

      // Logica per posizionare il testo (Simile ai FontMetrics di Java)
      if (pw > Math.max(titleWidth, dimWidth) + 10 && ph > 34) {
        // C'è spazio per titolo + dimensioni centrati
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = 'bold 12px Arial';
        ctx.fillText(title, px + pw / 2, py + ph / 2 - 6);

        ctx.font = '12px Arial';
        ctx.fillText(dimensions, px + pw / 2, py + ph / 2 + 8);
      } else if (pw > titleWidth + 5 && ph > 18) {
        // C'è spazio solo per il titolo in alto a sinistra
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(title, px + 5, py + 5);
      }
    });

    ctx.restore();

    // 4. Overlay Controlli (Come in Java, disegnato fuori dal ctx.restore per non essere zoomato)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.67)'; // Color(0, 0, 0, 170)

    // Disegno rettangolo arrotondato (supportato nei browser moderni)
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(15, 15, 390, 30, 10);
    } else {
      ctx.fillRect(15, 15, 390, 30); // Fallback per vecchi browser
    }
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText("🖱 Rotellina: Zoom | Trascina: Sposta | Doppio clic: Resetta vista", 25, 30);
  }

  // --- MOTORE DI DISEGNO ---

  private resizeCanvasAndDraw() {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    if (parent) {
      // Imposta la risoluzione reale del canvas in base alle dimensioni CSS
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      this.disegna();
    }
  }
}
