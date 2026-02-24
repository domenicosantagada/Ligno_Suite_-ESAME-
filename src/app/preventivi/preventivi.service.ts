// src/app/preventivi/preventivi.service.ts
import {inject, Injectable, signal} from '@angular/core';
import {InvoiceData, InvoiceItem} from './preventivi.model';
import {HttpClient} from '@angular/common/http';
import {Auth} from '../auth/auth';

@Injectable({
  providedIn: 'root'
})

export class PreventiviService {


  // 1. Aggiungi questa riga per ricordare il numero originale del documento aperto
  originalInvoiceNumber: string | null = null;

  private http = inject(HttpClient); // Inietta il client HTTP
  private authService = inject(Auth); // <-- Inietta Auth
  private apiUrl = 'http://localhost:8080/api/preventivi'; // L'URL di Spring Boot
  // Dati iniziali di default

  private initialData: InvoiceData = {
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0], // Data di oggi in formato YYYY-MM-DD
    fromName: '',
    fromEmail: '',
    fromPiva: '',
    toName: '',
    toEmail: '',
    toPiva: '',
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

  salvaPreventivoNelDb() {
    const data = this.invoice();

    // 1. CONTROLLO CAMPI VUOTI (Sicurezza)
    if (!data.invoiceNumber || data.invoiceNumber.trim() === '') {
      alert('Errore: Inserire un numero di preventivo.');
      return;
    }
    if (!data.toName || data.toName.trim() === '') {
      alert('Errore: Inserire il nome del cliente.');
      return;
    }

    const preventivoDaSalvare = JSON.parse(JSON.stringify(data));

    // AGGIUNGI L'ID DELL'UTENTE LOGGATO AL PREVENTIVO
    const utenteLoggato = this.authService.getUtenteLoggato();
    if (utenteLoggato) {
      preventivoDaSalvare.utenteId = utenteLoggato.id;
    }

    // 2. CAPIAMO L'INTENZIONE DELL'UTENTE
    // È un aggiornamento SOLO se l'utente aveva aperto un preventivo esistente
    // e NON ha cambiato il suo numero.
    const isUpdate = this.originalInvoiceNumber && (this.originalInvoiceNumber === preventivoDaSalvare.invoiceNumber);

    // 3. LOGICA "SALVA CON NOME"
    // Se ha cambiato numero, rigeneriamo gli ID delle righe per evitare conflitti nel DB
    if (this.originalInvoiceNumber && this.originalInvoiceNumber !== preventivoDaSalvare.invoiceNumber) {
      preventivoDaSalvare.items.forEach((item: any, index: number) => {
        item.id = Date.now().toString() + '-' + index;
      });
    }

    // 4. ESEGUIAMO LA CHIAMATA CORRETTA AL SERVER
    if (isUpdate) {
      // ---> MODALITÀ MODIFICA (Usa PUT)
      this.http.put<InvoiceData>(`${this.apiUrl}/${preventivoDaSalvare.invoiceNumber}`, preventivoDaSalvare).subscribe({
        next: () => {
          alert('Preventivo aggiornato con successo!');
        },
        error: (err) => {
          alert('Errore durante l\'aggiornamento: ' + (err.error?.message || 'Errore generico'));
          console.error(err);
        }
      });

    } else {
      // ---> MODALITÀ CREAZIONE O "SALVA CON NOME" (Usa POST)
      this.http.post<InvoiceData>(this.apiUrl, preventivoDaSalvare).subscribe({
        next: () => {
          alert('Nuovo preventivo salvato con successo!');
          // Ora il nuovo numero diventa l'originale
          this.originalInvoiceNumber = preventivoDaSalvare.invoiceNumber;
        },
        error: (err) => {
          // Gestione dell'errore "Duplicato" (409 Conflict dal backend)
          if (err.status === 409) {
            alert('Errore: Il numero preventivo "' + preventivoDaSalvare.invoiceNumber + '" è già utilizzato.');
          } else {
            alert('Errore durante il salvataggio: ' + (err.error?.message || 'Errore generico'));
          }
          console.error(err);
        }
      });
    }
  }

  // Aggiungi questo NUOVO metodo per leggere dal DB
  getTuttiIPreventivi() {
    const utenteLoggato = this.authService.getUtenteLoggato();
    const utenteId = utenteLoggato ? utenteLoggato.id : 0;

    // Aggiunge ?utenteId=X all'URL
    return this.http.get<InvoiceData[]>(`${this.apiUrl}?utenteId=${utenteId}`);
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
      fromPiva: '',
      toName: '',
      toEmail: '',
      toPiva: '',
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
