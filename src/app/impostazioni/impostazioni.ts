import {Component, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Auth} from '../auth/auth';
import Swal from 'sweetalert2';

export interface ProfiloAzienda {
  nomeAzienda: string;
  nomeTitolare: string;
  cognomeTitolare: string;
  email: string;
  telefono: string;
  partitaIva: string;
  codiceFiscale: string;
  indirizzo: string;
  citta: string;
  cap: string;
  provincia: string;
  logoBase64: string | ArrayBuffer | null;
}

@Component({
  selector: 'app-impostazioni',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './impostazioni.html',
  styleUrl: './impostazioni.css'
})
export class Impostazioni implements OnInit {
  authService = inject(Auth);

  // Dati iniziali vuoti
  profilo = signal<ProfiloAzienda>({
    nomeAzienda: '',
    nomeTitolare: '',
    cognomeTitolare: '',
    email: '',
    telefono: '',
    partitaIva: '',
    codiceFiscale: '',
    indirizzo: '',
    citta: '',
    cap: '',
    provincia: '',
    logoBase64: null
  });

  // Copia di backup per il tasto "Annulla"
  datiOriginali: ProfiloAzienda | null = null;

  ngOnInit() {
    this.caricaDatiUtente();
  }

  caricaDatiUtente() {
    const utente = this.authService.getUtenteLoggato();

    if (utente) {
      // Carichiamo tutti i campi. Se nel DB sono null, mettiamo una stringa vuota ''
      const datiCaricati: ProfiloAzienda = {
        nomeAzienda: utente.nomeAzienda || utente.nome || '', // 'nome' è quello storico della registrazione
        nomeTitolare: utente.nomeTitolare || '',
        cognomeTitolare: utente.cognomeTitolare || '',
        email: utente.email || '',
        telefono: utente.telefono || '',
        partitaIva: utente.partitaIva || '',
        codiceFiscale: utente.codiceFiscale || '',
        indirizzo: utente.indirizzo || '',
        citta: utente.citta || '',
        cap: utente.cap || '',
        provincia: utente.provincia || '',
        logoBase64: utente.logoBase64 || null
      };

      this.profilo.set(datiCaricati);
      this.datiOriginali = JSON.parse(JSON.stringify(datiCaricati));
    }
  }

  salvaImpostazioni() {
    const utenteLoggato = this.authService.getUtenteLoggato();
    if (!utenteLoggato) return;

    // Uniamo i dati vecchi di sicurezza (es. password) con i nuovi dati del profilo
    const datiDaInviare = {
      ...utenteLoggato,
      ...this.profilo() // Inserisce tutti i campi dell'interfaccia (indirizzo, logo, p.iva, ecc.)
    };

    // Chiamata al database tramite il Service
    this.authService.updateProfilo(utenteLoggato.id, datiDaInviare).subscribe({
      next: (utenteAggiornatoDalDb) => {
        // 1. Aggiorniamo i dati salvati nel browser
        this.authService.setUtenteLoggato(utenteAggiornatoDalDb);

        // 2. Aggiorniamo la copia di backup per il tasto "Annulla"
        this.datiOriginali = JSON.parse(JSON.stringify(this.profilo()));

        // 3. Mostriamo il messaggio di successo
        Swal.fire({
          title: 'Salvato!',
          text: 'Le impostazioni sono state aggiornate con successo.',
          icon: 'success',
          confirmButtonText: 'Ok',
          customClass: {confirmButton: 'btn btn-success px-4 rounded-pill'},
          buttonsStyling: false
        });
      },
      error: (err) => {
        console.error("Errore durante il salvataggio:", err);
        Swal.fire('Errore', 'Impossibile salvare le impostazioni.', 'error');
      }
    });
  }

  // Metodo per aggiornare i campi nel Signal
  updateProfilo(updates: Partial<ProfiloAzienda>) {
    this.profilo.update(current => ({...current, ...updates}));
  }

  // Gestione caricamento Logo
  onLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      // Controlla che sia un'immagine
      if (!file.type.startsWith('image/')) {
        Swal.fire('Errore', 'Per favore seleziona un file immagine (JPG, PNG).', 'error');
        return;
      }

      // Convertiamo l'immagine in Base64 per poterla salvare facilmente nel DB
      const reader = new FileReader();
      reader.onload = () => {
        this.updateProfilo({logoBase64: reader.result});
      };
      reader.readAsDataURL(file);
    }
  }

  rimuoviLogo() {
    this.updateProfilo({logoBase64: null});
  }

  alvaImpostazioni() {
    const utenteLoggato = this.authService.getUtenteLoggato();
    if (!utenteLoggato) return;

    // Uniamo i dati vecchi di sicurezza (es. password) con i nuovi dati del profilo
    const datiDaInviare = {
      ...utenteLoggato,
      ...this.profilo() // Inserisce tutti i campi dell'interfaccia (indirizzo, logo, p.iva, ecc.)
    };

    // Chiamata al database tramite il Service
    this.authService.updateProfilo(utenteLoggato.id, datiDaInviare).subscribe({
      next: (utenteAggiornatoDalDb) => {
        // 1. Aggiorniamo i dati salvati nel browser
        this.authService.setUtenteLoggato(utenteAggiornatoDalDb);

        // 2. Aggiorniamo la copia di backup per il tasto "Annulla"
        this.datiOriginali = JSON.parse(JSON.stringify(this.profilo()));

        // 3. Mostriamo il messaggio di successo
        Swal.fire({
          title: 'Salvato!',
          text: 'Le impostazioni sono state aggiornate con successo.',
          icon: 'success',
          confirmButtonText: 'Ok',
          customClass: {confirmButton: 'btn btn-success px-4 rounded-pill'},
          buttonsStyling: false
        });
      },
      error: (err) => {
        console.error("Errore durante il salvataggio:", err);
        Swal.fire('Errore', 'Impossibile salvare le impostazioni.', 'error');
      }
    });
  }

  annullaModifiche() {
    if (this.datiOriginali) {
      this.profilo.set(JSON.parse(JSON.stringify(this.datiOriginali)));
    }
  }
}
