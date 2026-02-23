// src/app/preventivi/preventivi.service.ts
import {inject, Injectable, signal} from '@angular/core';
import {InvoiceData, InvoiceItem} from './preventivi.model';
import {HttpClient} from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})

export class PreventiviService {


  // 1. Aggiungi questa riga per ricordare il numero originale del documento aperto
  originalInvoiceNumber: string | null = null;

  private http = inject(HttpClient); // Inietta il client HTTP
  private apiUrl = 'http://localhost:8080/api/preventivi'; // L'URL di Spring Boot
  // Dati iniziali di default
  private initialData: InvoiceData = {
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0], // Data di oggi in formato YYYY-MM-DD
    fromName: '',
    fromEmail: '',
    toName: '',
    toEmail: '',
    items: [{id: Date.now().toString(), description: '', quantity: 1, rate: 0, amount: 0}],
    taxRate: 22, // Possiamo impostare l'IVA italiana di default al 22%
    subtotal: 0,
    taxAmount: 0,
    total: 0
  };

  // Stato globale del preventivo gestito tramite Signal
  invoice = signal<InvoiceData>(this.initialData);

  // Metodo per aggiornare l'intero preventivo o parte di esso
  updateInvoice(updates: Partial<InvoiceData>) {
    this.invoice.update(current => {
      const newInvoice = {...current, ...updates};

      // Se aggiorniamo gli elementi o l'IVA, ricalcoliamo i totali
      if (updates.items || updates.taxRate !== undefined) {
        const itemsToCalc = updates.items || current.items;
        const taxToCalc = updates.taxRate !== undefined ? updates.taxRate : current.taxRate;

        const {subtotal, taxAmount, total} = this.calculateTotals(itemsToCalc, taxToCalc);

        newInvoice.subtotal = subtotal;
        newInvoice.taxAmount = taxAmount;
        newInvoice.total = total;
      }

      return newInvoice;
    });
  }

  // Aggiunge una nuova riga vuota
  addItem() {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
    };
    this.updateInvoice({items: [...this.invoice().items, newItem]});
  }

  // Rimuove una riga (assicurandosi che ne resti sempre almeno una)
  removeItem(index: number) {
    const currentItems = this.invoice().items;
    if (currentItems.length > 1) {
      const newItems = currentItems.filter((_, i) => i !== index);
      this.updateInvoice({items: newItems});
    }
  }

  // Aggiorna un singolo campo di una riga specifica e calcola il nuovo importo riga
  updateItem(index: number, field: keyof InvoiceItem, value: string | number) {
    const newItems = [...this.invoice().items];
    newItems[index] = {...newItems[index], [field]: value};

    if (field === 'quantity' || field === 'rate') {
      const quantityValue = newItems[index].quantity;
      const rateValue = newItems[index].rate;

      const quantity = typeof quantityValue === 'string' ? (quantityValue === '' ? 0 : Number(quantityValue)) : quantityValue;
      const rate = typeof rateValue === 'string' ? (rateValue === '' ? 0 : Number(rateValue)) : rateValue;

      newItems[index].amount = quantity * rate;
    }

    this.updateInvoice({items: newItems});
  }

  // 4. MODIFICA il metodo di salvataggio
  salvaPreventivoNelDb() {
    // Cloniamo i dati prima di inviarli
    const preventivoDaSalvare = JSON.parse(JSON.stringify(this.invoice()));

    // LA MAGIA: Se il numero preventivo è stato cambiato dall'utente,
    // significa che sta facendo un "Salva con nome" (nuovo preventivo).
    // Rigeneriamo gli ID delle righe per non far arrabbiare il database!
    if (this.originalInvoiceNumber && this.originalInvoiceNumber !== preventivoDaSalvare.invoiceNumber) {
      preventivoDaSalvare.items.forEach((item: any, index: number) => {
        item.id = Date.now().toString() + '-' + index;
      });
    }

    this.http.post<InvoiceData>(this.apiUrl, preventivoDaSalvare).subscribe({
      next: (response) => {
        alert('Preventivo salvato con successo nel database!');
        // Ora il nuovo numero diventa l'originale
        this.originalInvoiceNumber = preventivoDaSalvare.invoiceNumber;
      },
      error: (err) => {
        alert('Errore durante il salvataggio');
        console.error(err);
      }
    });
  }

  // Aggiungi questo NUOVO metodo per leggere dal DB
  getTuttiIPreventivi() {
    return this.http.get<InvoiceData[]>(this.apiUrl);
  }

  // Metodo per ELIMINARE dal DB
  eliminaPreventivoDalDb(id: string) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Aggiungi questo metodo per svuotare il form quando si crea un nuovo preventivo
  resetInvoice() {
    this.originalInvoiceNumber = null;
    this.invoice.set({
      invoiceNumber: '',
      date: new Date().toISOString().split('T')[0],
      fromName: '',
      fromEmail: '',
      toName: '',
      toEmail: '',
      items: [{id: Date.now().toString(), description: '', quantity: 1, rate: 0, amount: 0}],
      taxRate: 22,
      subtotal: 0,
      taxAmount: 0,
      total: 0
    });
  }

  // 3. AGGIUNGI QUESTO NUOVO METODO per caricare i dati dalla lista in modo sicuro
  caricaPreventivoPerModifica(prev: InvoiceData) {
    this.originalInvoiceNumber = prev.invoiceNumber;
    // Crea una copia slegata dai dati della lista per evitare problemi
    this.invoice.set(JSON.parse(JSON.stringify(prev)));
  }

  // Logica traslata fedelmente da utils/calculations.ts
  private calculateTotals(items: InvoiceItem[], taxRate: number | string) {
    const subtotal = items.reduce((sum, item) => {
      const amount = typeof item.amount === 'number' ? item.amount : 0;
      return sum + amount;
    }, 0);

    const rate = typeof taxRate === 'number' ? taxRate : taxRate === '' ? 0 : Number(taxRate);
    const taxAmount = (subtotal * rate) / 100;
    const total = subtotal + taxAmount;

    return {subtotal, taxAmount, total};
  }
}
