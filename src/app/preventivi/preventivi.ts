import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
// ActivatedRoute serve per leggere l'URL attuale e i suoi parametri (es. ?preview=true)
import {ActivatedRoute, RouterLink} from '@angular/router';
import {PreventiviService} from './preventivi.service';
import {RubricaService} from '../rubrica/rubrica.service';
import {Cliente} from '../rubrica/rubrica';
import {Auth} from '../auth/auth';
// Libreria esterna per convertire un pezzo di pagina HTML in un file PDF scaricabile
import html2pdf from 'html2pdf.js';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-preventivi',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './preventivi.html',
  styleUrl: './preventivi.css',
})
export class Preventivi implements OnInit {

  // variabile per tenere traccia della riga in fase di generazione IA, -1 se non in fase di generazione
  rigaInGenerazioneIA: number = -1;

  // Indice della riga che si sta trascinando
  draggedIndex: number | null = null;

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
  // Signal per sapere se l'utente è un cliente (modalità sola lettura)
  isCliente = signal(false);

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
  // --- VARIABILI PER LA MODALE EMAIL ---
  mostraModalEmail = signal(false);

  /* ==========================================================================
     LOGICA DI AUTOCOMPLETAMENTO
     ========================================================================== */
  emailDestinatario = '';
  emailOggetto = '';

  // Se l'utente clicca fuori dal campo di testo, dobbiamo nascondere la tendina.
  // Usiamo setTimeout (ritardo di 200ms) perché se la nascondessimo all'istante,
  emailMessaggio = '';
  emailNomeFile = '';

  /* ==========================================================================
     ROUTE GUARD: PROTEZIONE USCITA PAGINA
     ========================================================================== */

  /* ==========================================================================
     INIZIALIZZAZIONE COMPONENTE
     ========================================================================== */
  ngOnInit() {
    const utenteLoggato = this.authService.getUtenteLoggato();

    // 1. Controlla se l'utente è un cliente e imposta il signal
    if (utenteLoggato && utenteLoggato.ruolo === 'CLIENTE') {
      this.isCliente.set(true);
    }

    // 2. Leggiamo i parametri dell'URL
    this.route.queryParams.subscribe(params => {
      // Se arriviamo dalla lista cliccando sull'icona dell'occhio, OPPURE se l'utente è un CLIENTE,
      // forziamo la visualizzazione in modalità Anteprima/PDF.
      if (params['preview'] === 'true' || this.isCliente()) {
        this.isPreview.set(true);
      } else {
        this.isPreview.set(false);

        // Se è un nuovo preventivo (non ha numero) e NON siamo un cliente, chiediamo
        // al server di assegnare automaticamente il prossimo numero progressivo disponibile.
        if (!this.isCliente() && this.invoice().invoiceNumber === null) {
          // Allineiamo sempre i dati emittente con l'utente attualmente loggato
          this.preventiviService.allineaDatiEmittenteSilenzioso();

          // Chiediamo al backend il prossimo numero progressivo
          this.preventiviService.ottieniProssimoNumero();
        }
      }
    });

    // 3. RECUPERO LOGO AZIENDALE
    if (this.isCliente()) {
      // Magia del Backend: l'oggetto 'utente' (con il logo) viaggia già attaccato al preventivo!
      const falegname = (this.invoice() as any).utente;

      if (falegname && falegname.logoBase64) {
        this.logoAzienda.set(falegname.logoBase64);
      }
    } else {
      // 3. Caricamento del Logo aziendale del falegname (loggato)
      if (utenteLoggato && utenteLoggato.logoBase64) {
        this.logoAzienda.set(utenteLoggato.logoBase64);
      }

      // 4. Caricamento rubrica in background per far funzionare l'autocompletamento
      this.rubricaService.getClientiDalDb().subscribe({
        next: (dati) => this.clienti.set(dati),
        error: (err: any) => console.error('Errore caricamento clienti:', err) // Aggiunto ": any" per risolvere l'errore TS7006
      });
    }
  }

  /* ==========================================================================
     ESPORTAZIONE PDF
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

  /* ==========================================================================
     DRAG & DROP VOCI PREVENTIVO
     ========================================================================== */

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

  /**
   * Metodo chiamato dal Router di Angular se l'utente prova a cambiare pagina
   * (es. clicca "Home" sulla navbar) mentre sta compilando un preventivo.
   * Se restituisce true, lo fa uscire; se false, lo blocca sulla pagina.
   */
  async puoAbbandonarePagina(): Promise<boolean> {
    // Se è un cliente, esce direttamente senza avvisi
    if (this.isCliente()) {
      this.preventiviService.resetInvoice();
      return true;
    }

    // Se è un falegname
    // Se NON ci sono modifiche non salvate (nuvoletta verde), esci subito
    if (!this.preventiviService.hasUnsavedChanges()) {
      this.preventiviService.resetInvoice();
      return true;
    }

    // 2. Se ci SONO modifiche non salvate (nuvoletta rossa), mostriamo l'avviso
    const result = await Swal.fire({
      title: 'Vuoi uscire dalla pagina?',
      text: 'Ci sono modifiche non salvate che andranno perse.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sì, esci',
      cancelButtonText: 'Rimani',
      reverseButtons: true,
      focusConfirm: false,
      focusCancel: false,
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
      this.preventiviService.resetInvoice(); // Pulisce i dati
      return true; // L'utente conferma di voler perdere le modifiche
    } else {
      return false; // L'utente resta per salvare
    }
  }

  /*
  inviaPDFPerEmail() {
    const invoice = this.invoice();

    if (!invoice.toEmail || invoice.toEmail.trim() === '') {
      Swal.fire('Attenzione', 'Inserisci l\'email del cliente prima di inviare!', 'warning');
      return;
    }

    const element = document.getElementById('invoice-preview-container');
    if (element) {
      const numero = invoice.invoiceNumber ?? 'ND';
      const nomePulito = (invoice.toName || 'SenzaNome').trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      const fileName = `PREV_${numero}_${nomePulito}.pdf`;

      const opt: any = {
        margin: [2, 2],
        filename: fileName,
        image: {type: 'jpeg', quality: 1},
        html2canvas: {scale: 3, useCORS: true}, // Usa scale 3 per non far impazzire la memoria nell'invio file
        jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'}
      };

      // Mostra uno spinner di caricamento con Swal
      Swal.fire({
        title: 'Generazione e invio in corso...',
        text: 'Attendi un istante',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Anziché .save(), usiamo .output('blob') per ottenere il file senza scaricarlo
      html2pdf().set(opt).from(element).output('blob').then((pdfBlob: Blob) => {

        const formData = new FormData();
        formData.append('file', pdfBlob, fileName);
        formData.append('destinatario', invoice.toEmail!);
        formData.append('nomeCliente', invoice.toName || 'Cliente');

        // Chiamata al backend
        this.preventiviService.inviaPdfPerEmail(formData).subscribe({
          next: (res) => {
            Swal.fire('Inviato!', 'Il preventivo è stato inviato via email con successo.', 'success');
          },
          error: (err) => {
            console.error(err);
            Swal.fire('Errore', 'Si è verificato un problema durante l\'invio dell\'email.', 'error');
          }
        });
      });
    } else {
      Swal.fire('Errore', 'Impossibile generare il PDF. Passa alla visualizzazione anteprima.', 'error');
    }
  }
   */

  /**
   * Prende il contenitore HTML che fa da "Anteprima" e lo "stampa" in PDF
   */
  downloadPDF() {
    // Cerchiamo l'elemento HTML con ID "invoice-preview-container" (definito nel file .html)
    const element = document.getElementById('invoice-preview-container');

    // Se lo troviamo, usiamo la libreria html2pdf per convertirlo in PDF e scaricarlo.
    if (element) {

      const invoice = this.invoice();

      const numero = invoice.invoiceNumber ?? 'ND';

      const nomePulito = (invoice.toName || 'SenzaNome')
        .trim()
        .replace(/\s+/g, '_')           // spazi → underscore
        .replace(/[^\w\-]/g, '');       // rimuove caratteri non validi


      const fileName = `PREV_${numero}_${nomePulito}.pdf`;
      // Opzioni di configurazione per la libreria html2pdf
      const opt: any = {
        margin: [2, 2], // Margine in mm (top/bottom, left/right), prima dell'ai era 8,8
        filename: fileName,
        image: {type: 'jpeg', quality: 1}, // Qualità fotografica, se aumento troppo, il file diventa pesante. Max -> 1.0 min -> 0.1
        html2canvas: {scale: 14, useCORS: true}, // Scala per la renderizzazione (più alto = migliore qualità ma più lento), useCORS per caricare immagini da altre origini
        jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'}, // Foglio standard A4
        pagebreak: {mode: ['css', 'legacy']} // Gestisce il salto pagina se il preventivo è troppo lungo
      };

      // Genera e scarica automaticamente il PDF
      html2pdf().set(opt).from(element).save();
    } else {
      console.error("Elemento per l'anteprima del PDF non trovato!");
    }
  }

  generaDescrizioneIA(index: number) {
    const itemCorrente = this.invoice().items[index];
    const testoAttuale = itemCorrente.description;

    if (!testoAttuale || testoAttuale.trim() === '') {
      Swal.fire('Attenzione', 'Scrivi prima una breve descrizione da far migliorare all\'IA!', 'warning');
      return;
    }

    this.rigaInGenerazioneIA = index; // Imposta lo spinner per questa riga specifica

    this.preventiviService.miglioraDescrizioneConIA(testoAttuale).subscribe({
      next: (res) => {
        // Usiamo il metodo corretto del service per aggiornare la descrizione di quella specifica riga
        this.preventiviService.updateItem(index, 'description', res.descrizioneMigliorata);
        this.rigaInGenerazioneIA = -1; // Spegne lo spinner

        /* popup per notificare il successo della modifica
        const Toast = Swal.mixin({
          toast: true,
          position: 'bottom-end',
          showConfirmButton: false,
          timer: 3000
        });
        Toast.fire({icon: 'success', title: 'Descrizione migliorata con IA!'});
         */
      },
      error: (err) => {
        console.error(err);
        this.rigaInGenerazioneIA = -1;
        Swal.fire('Errore', 'Impossibile contattare l\'IA in questo momento.', 'error');
      }
    });
  }

  onDragStart(event: DragEvent, index: number) {
    this.draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent) {
    // Necessario per permettere il rilascio (drop)
    event.preventDefault();
  }

  onDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    if (this.draggedIndex !== null && this.draggedIndex !== dropIndex) {
      // Chiama il servizio per scambiare gli elementi
      this.preventiviService.riordinaItem(this.draggedIndex, dropIndex);
    }
    this.draggedIndex = null;
  }

  /* Apre la modale e precompila i campi */
  apriModalEmail() {
    const invoice = this.invoice();
    const numero = invoice.invoiceNumber ?? 'ND';
    const nomeCliente = invoice.toName || 'Cliente';
    const nomePulito = nomeCliente.trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');

    // Precompilazione dei campi
    this.emailNomeFile = `PREV_${nomePulito}.pdf`;
    this.emailDestinatario = invoice.toEmail || '';
    this.emailOggetto = `Preventivo - ${nomeCliente}`;
    this.emailMessaggio = `Gentile ${nomeCliente},\n\nIn allegato trova il preventivo richiesto.\n\nRimaniamo a disposizione per qualsiasi chiarimento.\n\nCordiali saluti.\n\n${invoice.fromName || 'La tua azienda'}`;

    // Mostra la finestra modale
    this.mostraModalEmail.set(true);
  }

  /* Chiude la modale annullando l'operazione */
  chiudiModalEmail() {
    this.mostraModalEmail.set(false);
  }

  /* Funzione che effettivamente genera il PDF e manda i dati al server */
  confermaInvioEmail() {
    if (!this.emailDestinatario || this.emailDestinatario.trim() === '') {
      Swal.fire('Attenzione', 'Inserisci l\'email del destinatario.', 'warning');
      return;
    }

    const element = document.getElementById('invoice-preview-container');
    if (element) {
      const fileName = this.emailNomeFile;

      const opt: any = {
        margin: [2, 2], // Margine in mm (top/bottom, left/right), prima dell'ai era 8,8
        filename: fileName,
        image: {type: 'jpeg', quality: 1}, // Qualità fotografica, se aumento troppo, il file diventa pesante. Max -> 1.0 min -> 0.1
        html2canvas: {scale: 7, useCORS: true}, // Scala per la renderizzazione (più alto = migliore qualità ma più lento), useCORS per caricare immagini da altre origini
        jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'}, // Foglio standard A4
        pagebreak: {mode: ['css', 'legacy']} // Gestisce il salto pagina se il preventivo è troppo lungo
      };

      Swal.fire({
        title: 'Generazione e invio in corso...',
        text: 'Attendi un istante',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      html2pdf().set(opt).from(element).output('blob').then((pdfBlob: Blob) => {

        const formData = new FormData();
        formData.append('file', pdfBlob, fileName);
        formData.append('destinatario', this.emailDestinatario);
        formData.append('oggetto', this.emailOggetto); // Ora passiamo l'oggetto modificabile
        formData.append('testo', this.emailMessaggio); // Ora passiamo il testo modificabile

        // Recupera i dati di chi sta inviando (adatta questo in base a come salvi i dati dell'utente)
        const utente = this.authService.getUtenteLoggato();
        const nomeAzienda = utente?.nomeAzienda || 'LignoSuite User';
        const emailUtente = utente?.email || 'noreply@tuosito.com';

        formData.append('nomeMittente', nomeAzienda);
        formData.append('emailMittente', emailUtente);

        this.preventiviService.inviaPdfPerEmail(formData).subscribe({
          next: (res) => {
            this.chiudiModalEmail(); // Chiudiamo la modale
            Swal.fire('Inviato!', 'Il preventivo è stato inviato via email con successo.', 'success');
          },
          error: (err) => {
            console.error(err);
            Swal.fire('Errore', 'Si è verificato un problema durante l\'invio dell\'email.', 'error');
          }
        });
      });
    } else {
      Swal.fire('Errore', 'Impossibile generare il PDF. Passa alla visualizzazione anteprima.', 'error');
    }
  }
}
