// src/app/preventivi/preventivi.ts
import {Component, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {PreventiviService} from './preventivi.service';

@Component({
  selector: 'app-preventivi',
  standalone: true,
  // Aggiungiamo CommonModule e FormsModule per usare le pipe (come currency o date) e l'ngModel nell'HTML
  imports: [CommonModule, FormsModule],
  templateUrl: './preventivi.html',
  styleUrl: './preventivi.css',
})
export class Preventivi {
  // 1. Iniettiamo il servizio che gestisce tutta la logica dei calcoli
  preventiviService = inject(PreventiviService);

  // 2. Esponiamo il Signal 'invoice' al template HTML per poter leggere i dati in tempo reale
  invoice = this.preventiviService.invoice;

  // 3. Creiamo un Signal locale per gestire lo stato della vista (Form vs Anteprima)
  isPreview = signal(false);

  // Metodo per passare dall'anteprima alla modifica e viceversa
  togglePreview() {
    this.isPreview.update(v => !v);
  }

  // Metodo provvisorio per scaricare il PDF (da implementare con librerie dedicate)
  downloadPDF() {
    alert("Funzionalità di download PDF da implementare!");
  }
}
