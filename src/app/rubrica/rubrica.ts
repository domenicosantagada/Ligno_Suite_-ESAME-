import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RubricaService} from './rubrica.service';

// Interfaccia aggiornata
export interface Cliente {
  id?: number | string; // Ora può essere numero (da DB) o indefinito (nuovo)
  utenteId?: number;    // ID del proprietario
  nome: string;
  email: string;
  telefono: string;
  partitaIva: string;
}

@Component({
  selector: 'app-rubrica',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rubrica.html',
  styleUrl: './rubrica.css',
})
export class Rubrica implements OnInit { // Implementiamo OnInit

  rubricaService = inject(RubricaService);

  // Lista inizialmente VUOTA
  clienti = signal<Cliente[]>([]);
  searchTerm = signal('');

  mostraForm = signal(false);

  // Cliente vuoto di base per il reset
  clienteVuoto: Cliente = {nome: '', email: '', telefono: '', partitaIva: ''};
  clienteCorrente = signal<Cliente>({...this.clienteVuoto});

  filteredClienti = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.clienti().filter(c =>
      c.nome.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term)
    );
  });

  // All'avvio della pagina, carica i clienti dal DB!
  ngOnInit() {
    this.caricaClienti();
  }

  caricaClienti() {
    this.rubricaService.getClientiDalDb().subscribe({
      next: (dati) => this.clienti.set(dati),
      error: (err) => console.error('Errore caricamento clienti:', err)
    });
  }

  creaNuovo() {
    this.clienteCorrente.set({...this.clienteVuoto}); // Svuota il form
    this.mostraForm.set(true);
  }

  modificaCliente(cliente: Cliente) {
    this.clienteCorrente.set({...cliente}); // Copia i dati
    this.mostraForm.set(true);
  }

  annulla() {
    this.mostraForm.set(false);
  }

  aggiornaCampoForm(campo: keyof Cliente, valore: string) {
    this.clienteCorrente.update(c => ({...c, [campo]: valore}));
  }

  salvaCliente() {
    const dati = this.clienteCorrente();

    if (!dati.nome || dati.nome.trim() === '') {
      alert('Inserisci almeno la Ragione Sociale / Nome.');
      return;
    }

    // Chiamata al backend
    this.rubricaService.salvaClienteNelDb(dati).subscribe({
      next: () => {
        this.caricaClienti(); // Ricarica la tabella con i dati aggiornati
        this.mostraForm.set(false); // Chiudi il form
      },
      error: (err) => {
        alert('Errore durante il salvataggio del cliente.');
        console.error(err);
      }
    });
  }

  eliminaCliente(id?: number | string) {
    if (!id) return;

    if (confirm('Sei sicuro di voler eliminare questo cliente?')) {
      this.rubricaService.eliminaClienteDalDb(id).subscribe({
        next: () => {
          this.caricaClienti(); // Ricarica la tabella aggiornata
        },
        error: (err) => console.error('Errore durante l\'eliminazione:', err)
      });
    }
  }
}
