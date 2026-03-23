import {ChangeDetectorRef, Component, inject, OnInit, signal} from '@angular/core';
// Serve per forzare l'aggiornamento della vista quando Angular non lo fa automaticamente
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Auth} from '../auth/auth';
// Libreria per popup più belli degli alert standard
import Swal from 'sweetalert2';

/**
 * Struttura dati del profilo aziendale
 */
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
  standalone: true, // componente indipendente (no NgModule)
  imports: [CommonModule, FormsModule], // necessario per usare ngModel
  templateUrl: './impostazioni.html',
  styleUrl: './impostazioni.css'
})
export class Impostazioni implements OnInit {

  authService = inject(Auth); // gestione utente e chiamate API
  cdr = inject(ChangeDetectorRef); // forza aggiornamento UI

  // messaggio errore email (es. duplicata)
  erroreEmail = '';

  /**
   * Signal che contiene i dati del form.
   * Quando cambia, la UI si aggiorna automaticamente.
   */
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

  // copia dei dati iniziali (serve per annullare modifiche)
  datiOriginali: ProfiloAzienda | null = null;

  // viene eseguito alla creazione del componente
  ngOnInit() {
    this.caricaDatiUtente();
  }

  /* ====================== DATI UTENTE ====================== */

  /**
   * Carica i dati dell'utente loggato e li inserisce nel form
   */
  caricaDatiUtente() {
    const utente = this.authService.getUtenteLoggato();

    if (utente) {
      // normalizza i dati (evita null)
      const datiCaricati: ProfiloAzienda = {
        nomeAzienda: utente.nomeAzienda || utente.nome || '',
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

      // salva copia indipendente dei dati iniziali
      this.datiOriginali = JSON.parse(JSON.stringify(datiCaricati));
    }
  }

  /**
   * Salva i dati modificati nel backend
   */
  salvaImpostazioni() {
    const utenteLoggato = this.authService.getUtenteLoggato();
    if (!utenteLoggato) return;

    // unisce dati originali + modifiche del form
    const datiDaInviare = {
      ...utenteLoggato,
      ...this.profilo()
    };

    this.authService.updateProfilo(utenteLoggato.id, datiDaInviare).subscribe({
      next: (utenteAggiornatoDalDb) => {
        // aggiorna sessione locale
        this.authService.setUtenteLoggato(utenteAggiornatoDalDb);

        // aggiorna backup
        this.datiOriginali = JSON.parse(JSON.stringify(this.profilo()));

        // messaggio successo
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
        console.error('Errore durante il salvataggio:', err);

        // email duplicata
        if (err.status === 409) {
          this.erroreEmail = 'Questa email è già in uso da un altro utente.';
          this.cdr.detectChanges();
        } else {
          Swal.fire('Errore', 'Impossibile salvare le impostazioni.', 'error');
        }
      }
    });
  }

  /**
   * Aggiorna solo alcuni campi del profilo
   */
  updateProfilo(updates: Partial<ProfiloAzienda>) {
    this.profilo.update(current => ({...current, ...updates}));
  }

  /* ====================== LOGO ====================== */

  /**
   * Gestisce selezione file immagine
   */
  onLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];

    if (file) {
      // controlla che sia immagine
      if (!file.type.startsWith('image/')) {
        Swal.fire('Errore', 'Seleziona un file immagine (JPG, PNG).', 'error');
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        // salva immagine in formato Base64
        this.updateProfilo({logoBase64: reader.result});
      };

      reader.readAsDataURL(file);
    }
  }

  /**
   * Rimuove il logo
   */
  rimuoviLogo() {
    this.updateProfilo({logoBase64: null});
  }

  /**
   * Ripristina i dati iniziali
   */
  annullaModifiche() {
    if (this.datiOriginali) {
      this.profilo.set(JSON.parse(JSON.stringify(this.datiOriginali)));
    }
  }
}
