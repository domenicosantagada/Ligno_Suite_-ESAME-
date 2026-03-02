import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
// ActivatedRoute serve per leggere l'URL attuale e i suoi parametri (es. ?preview=true)
import {ActivatedRoute} from '@angular/router';
import {PreventiviService} from './preventivi.service';
import {RubricaService} from '../rubrica/rubrica.service';
import {Cliente} from '../rubrica/rubrica';
import {Auth} from '../auth/auth';
import Swal from 'sweetalert2';
// Libreria esterna per convertire un pezzo di pagina HTML in un file PDF scaricabile
import html2pdf from 'html2pdf.js';

@Component({
  selector: 'app-preventivi',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './preventivi.html',
  styleUrl: './preventivi.css',
})
export class Preventivi implements OnInit {

  /* ==========================================================================
     DEPENDENCY INJECTION
     ========================================================================== */
  preventiviService = inject(PreventiviService);
  route = inject(ActivatedRoute);
  rubricaService = inject(RubricaService);
  authService = inject(Auth);

  /* ==========================================================================
     STATO DEL COMPONENTE (Signals)
     ========================================================================== */

  // Creiamo un "collegamento diretto" al preventivo gestito dal Service.
  // In questo modo, modificando l'invoice qui, si aggiorna anche nel Service.
  invoice = this.preventiviService.invoice;

  // Gestisce la visualizzazione: true = Anteprima PDF / false = Modalità Modifica
  isPreview = signal(false);

  // Variabili per gestire la tendina di ricerca clienti (Autocompletamento)
  clienti = signal<Cliente[]>([]);
  mostraDropdownClienti = signal(false);

  // Signal per l'immagine del logo (con un'immagine di default nel caso manchi)
  logoAzienda = signal<string>('image/no_logo.png');

  /**
   * SIGNAL CALCOLATO (Computed) per l'autocompletamento.
   * Si ricalcola automaticamente non appena l'utente digita qualcosa nel campo "Nome Cliente"
   * o quando la lista dei 'clienti' viene caricata dal database.
   */
  clientiFiltrati = computed(() => {
    // Legge il nome attualmente scritto nel preventivo
    const term = (this.invoice().toName || '').toLowerCase().trim();
    if (!term) return this.clienti(); // Se è vuoto, mostra tutta la rubrica

    // Altrimenti, filtra i clienti che contengono il testo digitato
    return this.clienti().filter(c => c.nome.toLowerCase().includes(term));
  });

  /* ==========================================================================
     INIZIALIZZAZIONE COMPONENTE
     ========================================================================== */
  ngOnInit() {
    // 1. Leggiamo i parametri dell'URL
    this.route.queryParams.subscribe(params => {
      // Se arriviamo dalla lista cliccando sull'icona dell'occhio, l'URL avrà "?preview=true"
      if (params['preview'] === 'true') {
        this.isPreview.set(true);
      } else {
        this.isPreview.set(false);

        // Se è un nuovo preventivo (non ha numero), chiediamo al server di assegnare
        // automaticamente il prossimo numero progressivo disponibile.
        if (this.invoice().invoiceNumber === null) {
          this.preventiviService.ottieniProssimoNumero();
        }
      }
    });

    // 2. Caricamento del Logo
    const utenteLoggato = this.authService.getUtenteLoggato();
    if (utenteLoggato && utenteLoggato.logoBase64) {
      this.logoAzienda.set(utenteLoggato.logoBase64);
    }

    // 3. Caricamento rubrica in background per far funzionare l'autocompletamento
    this.rubricaService.getClientiDalDb().subscribe({
      next: (dati) => this.clienti.set(dati),
      error: (err) => console.error('Errore caricamento clienti:', err)
    });
  }

  /* ==========================================================================
     LOGICA DI AUTOCOMPLETAMENTO
     ========================================================================== */

  // Scatta a ogni tasto premuto nel campo di testo del nome cliente
  onNomeClienteChange(valore: string) {
    this.preventiviService.updateInvoice({toName: valore});
    this.mostraDropdownClienti.set(true); // Apre la tendina
  }

  // Scatta quando si clicca un cliente dalla tendina
  selezionaClienteDaDropdown(cliente: Cliente) {
    // Compila magicamente in un colpo solo nome, email e P.Iva usando i dati della rubrica!
    this.preventiviService.updateInvoice({
      toName: cliente.nome,
      toEmail: cliente.email || '',
      toPiva: cliente.partitaIva || ''
    });
    this.mostraDropdownClienti.set(false); // Chiude la tendina
  }

  // Se l'utente clicca fuori dal campo di testo, dobbiamo nascondere la tendina.
  // Usiamo setTimeout (ritardo di 200ms) perché se la nascondessimo all'istante,
  // l'utente non farebbe in tempo a cliccare fisicamente sulla voce che gli interessa!
  nascondiDropdownRitardato() {
    setTimeout(() => {
      this.mostraDropdownClienti.set(false);
    }, 200);
  }

  togglePreview() {
    // Inverte il valore del Signal (se era true diventa false, e viceversa)
    this.isPreview.update(v => !v);
  }

  /* ==========================================================================
     ROUTE GUARD: PROTEZIONE USCITA PAGINA
     ========================================================================== */

  /**
   * Metodo chiamato dal Router di Angular se l'utente prova a cambiare pagina
   * (es. clicca "Home" sulla navbar) mentre sta compilando un preventivo.
   * Se restituisce true, lo fa uscire; se false, lo blocca sulla pagina.
   */
  async puoAbbandonarePagina(): Promise<boolean> {
    const inv = this.invoice();

    // Controlliamo se ha scritto qualcosa
    const haDati =
      inv.toName !== '' ||
      inv.fromName !== '' ||
      (inv.items.length > 0 && inv.items[0].description !== '');

    // Se è vuoto, può uscire tranquillamente
    if (!haDati) {
      this.preventiviService.resetInvoice();
      return true;
    }

    // Se ci sono dati, mostriamo il popup customizzato SweetAlert
    const result = await Swal.fire({
      title: 'Vuoi uscire dalla pagina?',
      text: 'I dati che non hai salvato andranno persi.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sì, esci',
      cancelButtonText: 'Rimani',
      reverseButtons: true,
      focusConfirm: false,
      focusCancel: false,
      // Trucco per togliere la selezione automatica dai bottoni appena il popup appare
      didOpen: () => {
        (document.activeElement as HTMLElement)?.blur();
      },
      customClass: {
        popup: 'rounded-4 shadow-sm border-0',
        confirmButton: 'btn btn-dark px-4 rounded-pill ms-2',
        cancelButton: 'btn btn-outline-secondary px-4 rounded-pill'
      },
      buttonsStyling: false
    });

    if (result.isConfirmed) {
      this.preventiviService.resetInvoice(); // Pulisce i dati prima di andarsene
      return true;
    } else {
      return false; // L'utente ha deciso di restare
    }
  }

  /* ==========================================================================
     ESPORTAZIONE PDF
     ========================================================================== */

  /**
   * Prende il contenitore HTML che fa da "Anteprima" e lo "stampa" in PDF
   */
  downloadPDF() {
    // Cerchiamo l'elemento HTML con ID "invoice-preview-container" (definito nel file .html)
    const element = document.getElementById('invoice-preview-container');

    // Se lo troviamo, usiamo la libreria html2pdf per convertirlo in PDF e scaricarlo.
    if (element) {
      // Nome dinamico del file basato sul numero del preventivo oppure un nome di default se il numero non è presente
      const fileName = this.invoice().invoiceNumber ? `Preventivo_${this.invoice().invoiceNumber}.pdf` : 'Preventivo_ND.pdf';

      // Opzioni di configurazione per la libreria html2pdf
      const opt: any = {
        margin: [0, 0, 0, 0],
        filename: fileName,
        image: {type: 'jpeg', quality: 0.1}, // Qualità fotografica, se aumento troppo, il file diventa pesante. Max -> 1.0 min -> 0.1
        html2canvas: {scale: 16, useCORS: true}, // Scala a 2 migliora la nitidezza del testo (valore da 1 a 3), useCORS serve per caricare immagini da altre origini (es. logo azienda in base64)
        jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'}, // Foglio standard A4
        pagebreak: {mode: ['css', 'legacy']} // Gestisce il salto pagina se il preventivo è troppo lungo
      };

      // Genera e scarica automaticamente il PDF
      html2pdf().set(opt).from(element).save();
    } else {
      console.error("Elemento per l'anteprima del PDF non trovato!");
    }
  }
}
