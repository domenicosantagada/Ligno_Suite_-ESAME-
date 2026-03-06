import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {Articolo, PrezzarioService} from './prezziario.service';
import Swal from 'sweetalert2';
import {FormsModule} from '@angular/forms';
import {DatePipe, DecimalPipe} from '@angular/common';

@Component({
  selector: 'app-prezzario',
  imports: [
    FormsModule,
    DecimalPipe,
    DatePipe
  ],
  templateUrl: './prezzario.html',
  styleUrl: './prezzario.css',
})
export class Prezzario implements OnInit {

  // Inietta il servizio PrezzarioService per interagire con il backend
  prezzarioService = inject(PrezzarioService);

  // Stato dell'applicazione
  // Signal: serve per gestire lo stato dell'applicazione in modo semplice e sicuro
  //  (non dobbiamo fare un controllo di stato in un componente di Angular)
  // quindi quando cambia il valore del signal, Angular ri-aggiorna automaticamente il template HTML
  articoli = signal<Articolo[]>([]);
  searchTerm = signal('');

  // Articolo temporaneo per il form (Aggiunta/Modifica)
  articoloForm: Articolo = this.getEmptyArticolo();
  isEditing = false; // Capisce se stiamo creando o modificando
  mostraForm = false; // Mostra/Nasconde la sezione di inserimento

  // computed() ricalcola automaticamente la lista quando scriviamo nella barra di ricerca
  articoliFiltrati = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.articoli();

    return this.articoli().filter(a =>
      a.nome.toLowerCase().includes(term) ||
      (a.fornitore && a.fornitore.toLowerCase().includes(term))
    );
  });


  ngOnInit(): void {
    this.caricaArticoli();
  }

  // CaricaArticoli: metodo per caricare i dati dal database
  //  (esegue una richiesta GET al backend)
  //  (esegue il subscribe per ricevere i dati e aggiornare l'array di articoli)
  caricaArticoli() {
    this.prezzarioService.getArticoliDalDb().subscribe({
      next: (data) => this.articoli.set(data),
      error: (err) => {
        console.error('Errore caricamento prezzario', err);
        Swal.fire('Errore', 'Impossibile caricare il prezzario.', 'error');
      }
    });
  }


  // --- GESTIONE FORM ---

  // Genera un articolo vuoto con la data di oggi formattata correttamente
  getEmptyArticolo(): Articolo {
    const oggi = new Date().toISOString().split('T')[0];

    return {
      nome: '',
      prezzoAcquisto: 0,
      fornitore: '',
      dataAcquisto: oggi,
      unitaMisura: 'pz'
    };
  }

  apriFormNuovo() {
    this.isEditing = false;
    this.articoloForm = this.getEmptyArticolo();
    this.mostraForm = true;
  }

  apriFormModifica(articolo: Articolo) {
    this.isEditing = true;

    // Creiamo una copia per non modificare visivamente la riga prima di aver salvato
    this.articoloForm = {...articolo};

    // Gestione sicura della data per l'input type="date"
    if (this.articoloForm.dataAcquisto) {
      this.articoloForm.dataAcquisto = this.articoloForm.dataAcquisto.toString().split('T')[0];
    } else {
      this.articoloForm.dataAcquisto = null;
    }

    this.mostraForm = true;
  }

  chiudiForm() {
    this.mostraForm = false;
  }

  salvaArticolo() {
    // 1. Validazioni di sicurezza
    if (!this.articoloForm.nome || this.articoloForm.nome.trim() === '') {
      Swal.fire('Attenzione', 'Inserisci il nome del materiale.', 'warning');
      return;
    }
    if (this.articoloForm.prezzoAcquisto === null || this.articoloForm.prezzoAcquisto < 0) {
      Swal.fire('Attenzione', 'Inserisci un prezzo di acquisto valido.', 'warning');
      return;
    }

    // 2. Pulizia Date per Spring Boot
    if (!this.articoloForm.dataAcquisto || this.articoloForm.dataAcquisto.trim() === '') {
      this.articoloForm.dataAcquisto = null;
    }

    // 3. Operazioni CRUD
    if (this.isEditing && this.articoloForm.id) {
      // MODIFICA
      this.prezzarioService.modificaArticolo(this.articoloForm.id, this.articoloForm).subscribe({
        next: (articoloAggiornato) => {
          // Sostituisce la riga vecchia con la nuova nel Signal
          this.articoli.update(lista => lista.map(art => art.id === articoloAggiornato.id ? articoloAggiornato : art));
          this.chiudiForm();
          this.toastSuccesso('Articolo aggiornato!');
        },
        error: (err) => {
          console.error('Errore modifica:', err);
          Swal.fire('Errore', 'Impossibile modificare l\'articolo.', 'error');
        }
      });
    } else {
      // AGGIUNTA
      this.prezzarioService.aggiungiArticolo(this.articoloForm).subscribe({
        next: (nuovoArticolo) => {
          // Aggiunge la nuova riga in cima alla tabella istantaneamente
          this.articoli.update(lista => [nuovoArticolo, ...lista]);
          this.chiudiForm();
          this.toastSuccesso('Articolo aggiunto al prezzario!');
        },
        error: (err) => {
          console.error('Errore aggiunta:', err);
          Swal.fire('Errore', 'Impossibile salvare l\'articolo.', 'error');
        }
      });
    }
  }

  eliminaArticolo(articolo: Articolo) {
    Swal.fire({
      title: 'Sei sicuro?',
      text: `Vuoi eliminare "${articolo.nome}" dal prezzario?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sì, elimina',
      cancelButtonText: 'Annulla'
    }).then((result) => {
      if (result.isConfirmed && articolo.id) {
        this.prezzarioService.eliminaArticolo(articolo.id).subscribe({
          next: () => {
            // Rimuove la riga dalla tabella istantaneamente senza ricaricare dal DB
            this.articoli.update(lista => lista.filter(art => art.id !== articolo.id));
            this.toastSuccesso('Articolo eliminato');
          },
          error: (err) => {
            console.error('Errore eliminazione:', err);
            Swal.fire('Errore', 'Impossibile eliminare l\'articolo.', 'error');
          }
        });
      }
    });
  }

  // Metodo per il popup "silenzioso" in basso a destra
  private toastSuccesso(messaggio: string) {
    Swal.fire({
      toast: true,
      position: 'bottom-end',
      showConfirmButton: false,
      timer: 3000,
      icon: 'success',
      title: messaggio
    });
  }

}
