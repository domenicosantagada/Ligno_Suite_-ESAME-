import {Component, computed, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

// Definiamo la struttura di un Cliente
export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefono: string;
  partitaIva: string;
}

@Component({
  selector: 'app-rubrica',
  standalone: true,
  imports: [CommonModule, FormsModule], // Importiamo FormsModule per la barra di ricerca
  templateUrl: './rubrica.html',
  styleUrl: './rubrica.css',
})
export class Rubrica {

  // Dati finti di prova (successivamente li caricheremo dal DB come i preventivi)
  clienti = signal<Cliente[]>([
    {
      id: '1',
      nome: 'Mario Rossi Carpenteria',
      email: 'info@mariorossi.it',
      telefono: '02 1234567',
      partitaIva: 'IT12345678901'
    },
    {
      id: '2',
      nome: 'Studio Architettura Verdi',
      email: 'progetti@studioverdi.com',
      telefono: '333 9876543',
      partitaIva: 'IT09876543210'
    }
  ]);

  searchTerm = signal('');

  // Filtra la tabella in tempo reale in base a nome o email
  filteredClienti = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.clienti().filter(c =>
      c.nome.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term)
    );
  });

  // Azioni dei pulsanti
  creaNuovo() {
    alert('Presto aprirò una schermata per inserire un nuovo cliente!');
  }

  modificaCliente(cliente: Cliente) {
    alert(`Presto aprirò la schermata per modificare: ${cliente.nome}`);
  }

  eliminaCliente(id: string) {
    if (confirm('Sei sicuro di voler eliminare questo cliente dalla rubrica?')) {
      // Rimuove il cliente dalla lista locale
      this.clienti.update(list => list.filter(c => c.id !== id));
    }
  }
}
