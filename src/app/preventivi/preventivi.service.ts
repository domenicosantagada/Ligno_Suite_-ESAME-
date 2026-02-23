// src/app/preventivi/preventivi.service.ts
import {Injectable, signal} from '@angular/core';
import {InvoiceData, InvoiceItem} from './preventivi.model';

@Injectable({
  providedIn: 'root'
})
export class PreventiviService {

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
