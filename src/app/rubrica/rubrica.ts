import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RubricaService} from './rubrica.service';
import Swal from 'sweetalert2';

/**
 * INTERFACCIA CLIENTE
 * Definisce i campi che compongono un contatto nella nostra rubrica.
 */
export interface Cliente {
  id?: number | string; // È opzionale (?) perché un cliente "nuovo" non ha ancora un ID finché non lo salva il DB
  utenteId?: number;    // ID dell'utente (falegname) a cui appartiene questo cliente
  nome: string;
  email: string;
  telefono: string;
  partitaIva: string;
}

@Component({
  selector: 'app-rubrica',
  standalone: true,
  imports: [CommonModule, FormsModule], // FormsModule è vitale per usare ngModel nei campi di testo
  templateUrl: './rubrica.html',
  styleUrl: './rubrica.css',
})
export class Rubrica implements OnInit {

  // Inietta il servizio che fa le chiamate al server
  rubricaService = inject(RubricaService);

  /* ==========================================================================
     STATO DEL COMPONENTE (Gestito con i Signal)
     ========================================================================== */

  // Lista di tutti i clienti caricati dal DB (inizialmente vuota)
  clienti = signal<Cliente[]>([]);

  // Testo digitato nella barra di ricerca
  searchTerm = signal('');

  // "Interruttore" per l'interfaccia:
  // false = mostra la tabella dei clienti | true = mostra il form di inserimento/modifica
  mostraForm = signal(false);

  // Un oggetto "vuoto" che usiamo come template per resettare il form
  clienteVuoto: Cliente = {nome: '', email: '', telefono: '', partitaIva: ''};

  // Contiene i dati del cliente che stiamo correntemente creando o modificando nel form
  clienteCorrente = signal<Cliente>({...this.clienteVuoto});

  /**
   * SIGNAL CALCOLATO per la barra di ricerca.
   * Filtra in automatico l'array dei 'clienti' ogni volta che si digita qualcosa in 'searchTerm'.
   */
  filteredClienti = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.clienti().filter(c =>
      c.nome.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term)
    );
  });

  /* ==========================================================================
     CICLO DI VITA E CHIAMATE AL DATABASE
     ========================================================================== */

  // All'avvio della pagina, carica la lista dei clienti
  ngOnInit() {
    this.caricaClienti();
  }

  caricaClienti() {
    this.rubricaService.getClientiDalDb().subscribe({
      next: (dati) => this.clienti.set(dati),
      error: (err) => console.error('Errore caricamento clienti:', err)
    });
  }

  /* ==========================================================================
     GESTIONE DELL'INTERFACCIA (Tabella <--> Form)
     ========================================================================== */

  /**
   * Prepara il form per un NUOVO cliente
   */
  creaNuovo() {
    // Carica il cliente vuoto usando lo spread operator (...)
    this.clienteCorrente.set({...this.clienteVuoto});
    this.mostraForm.set(true); // Nasconde la tabella, mostra il form
  }

  /**
   * Prepara il form per MODIFICARE un cliente esistente
   */
  modificaCliente(cliente: Cliente) {
    // Copia i dati del cliente selezionato dentro il form
    this.clienteCorrente.set({...cliente});
    this.mostraForm.set(true);
  }

  /**
   * Esce dal form senza salvare
   */
  annulla() {
    this.mostraForm.set(false); // Torna alla tabella
  }

  /**
   * Aggiorna un singolo campo (es. 'nome' o 'telefono') del cliente che stiamo scrivendo.
   * keyof Cliente garantisce che 'campo' sia esattamente una delle proprietà dell'interfaccia (es. non puoi passargli 'colore').
   */
  aggiornaCampoForm(campo: keyof Cliente, valore: string) {
    this.clienteCorrente.update(c => ({...c, [campo]: valore}));
  }

  /* ==========================================================================
     SALVATAGGIO ED ELIMINAZIONE
     ========================================================================== */

  salvaCliente() {
    const dati = this.clienteCorrente();

    // Validazione base obbligatoria
    if (!dati.nome || dati.nome.trim() === '') {
      Swal.fire('Attenzione', 'Inserisci almeno la Ragione Sociale / Nome.', 'warning');
      return;
    }

    // Invia i dati al servizio (che deciderà in automatico se fare POST o PUT)
    this.rubricaService.salvaClienteNelDb(dati).subscribe({
      next: () => {
        // Se va a buon fine, scarichiamo di nuovo la lista aggiornata dal DB
        this.caricaClienti();
        // E torniamo alla schermata della tabella
        this.mostraForm.set(false);
        // Mostriamo un messaggio di successo (usando SweetAlert2)
        Swal.fire({
          title: 'Salvato!',
          text: 'Cliente salvato in rubrica.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: (err) => {
        // Mostriamo un messaggio di errore (usando SweetAlert2)
        Swal.fire('Errore', 'Errore durante il salvataggio del cliente.', 'error');
        console.error(err);
      }
    });
  }


  eliminaCliente(id?: number | string) {
    if (!id) return;

    Swal.fire({
      title: 'Eliminare cliente?',
      text: 'Questa azione non può essere annullata.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sì, elimina',
      cancelButtonText: 'Annulla',
      reverseButtons: true,
      customClass: {
        confirmButton: 'btn btn-danger px-4 rounded-pill ms-2',
        cancelButton: 'btn btn-outline-secondary px-4 rounded-pill'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.rubricaService.eliminaClienteDalDb(id).subscribe({
          next: () => {
            this.caricaClienti();
            Swal.fire({
              title: 'Eliminato!',
              text: 'Cliente rimosso dalla rubrica.',
              icon: 'success',
              timer: 1000,
              showConfirmButton: false
            });
          },
          error: (err) => {
            console.error('Errore durante l\'eliminazione:', err);
            Swal.fire('Errore', 'Impossibile eliminare il cliente.', 'error');
          }
        });
      }
    });
  }
}
