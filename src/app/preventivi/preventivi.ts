import {Component, inject, OnInit, signal} from '@angular/core'; // Aggiungi OnInit
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router'; // Aggiungi ActivatedRoute
import {PreventiviService} from './preventivi.service';

// @ts-ignore
import html2pdf from 'html2pdf.js';

@Component({
  selector: 'app-preventivi',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './preventivi.html',
  styleUrl: './preventivi.css',
})
export class Preventivi implements OnInit { // Implementa OnInit
  preventiviService = inject(PreventiviService);
  route = inject(ActivatedRoute); // Inietta la rotta per leggere l'URL

  invoice = this.preventiviService.invoice;
  isPreview = signal(false);

  // Appena la pagina si carica...
  ngOnInit() {
    // Controlla se c'è "?preview=true" nell'URL
    this.route.queryParams.subscribe(params => {
      if (params['preview'] === 'true') {
        this.isPreview.set(true); // Se sì, accende direttamente l'anteprima!
      } else {
        this.isPreview.set(false); // Altrimenti mostra il form per la modifica
      }
    });
  }

  togglePreview() {
    this.isPreview.update(v => !v);
  }

  downloadPDF() {
    const element = document.getElementById('invoice-preview-container');

    if (element) {
      const fileName = this.invoice().invoiceNumber ? `Preventivo_${this.invoice().invoiceNumber}.pdf` : 'Preventivo_Bozza.pdf';

      // Aggiungiamo ": any" qui per dire a TypeScript di ignorare l'errore sui tipi
      const opt: any = {
        margin: [10, 10, 15, 10],
        filename: fileName,
        image: {type: 'jpeg', quality: 0.98},
        html2canvas: {scale: 2, useCORS: true},
        jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'},
        pagebreak: {mode: ['css', 'legacy']}
      };

      html2pdf().set(opt).from(element).save();
    } else {
      console.error("Elemento per l'anteprima del PDF non trovato!");
    }
  }
}
