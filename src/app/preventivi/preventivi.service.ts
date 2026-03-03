import {inject, Injectable, signal} from '@angular/core';
import {InvoiceData, InvoiceItem} from './preventivi.model';
import {HttpClient} from '@angular/common/http';
import {Auth} from '../auth/auth';

/**
 * SERVIZIO PREVENTIVI
 * Gestisce la logica di business (calcoli, formattazione) e le chiamate HTTP al backend.
 * Essendo "providedIn: 'root'", i dati inseriti qui sopravvivono ai cambi di pagina.
 */
@Injectable({
  providedIn: 'root'
})
export class PreventiviService {

  // Fondamentale per capire se stiamo modificando un preventivo esistente o creandone uno nuovo/clonato.
  originalInvoiceNumber: number | null = null;

  private http = inject(HttpClient);
  private authService = inject(Auth);
  private apiUrl = 'http://localhost:8080/api/preventivi';

  // Oggetto "scheletro" usato per resettare o inizializzare un nuovo preventivo
  private initialData: InvoiceData = {
    invoiceNumber: null,
    date: new Date().toISOString().split('T')[0], // Data di oggi (YYYY-MM-DD)
    fromName: '', fromEmail: '', fromPiva: '',
    toName: '', toEmail: '', toPiva: '',
    items: [{id: Date.now().toString(), description: '', unitaMisura: 'pz', quantity: 1, rate: 0, amount: 0}],
    taxRate: 22, subtotal: 0, taxAmount: 0, discount: 0, total: 0
  };

  /**
   * SIGNAL DELLO STATO: contiene il preventivo correntemente aperto.
   */
  invoice = signal<InvoiceData>(this.initialData);

  ottieniProssimoNumero() {
    const utenteLoggato = this.authService.getUtenteLoggato();
    if (!utenteLoggato) return;

    this.http.get<number>(`${this.apiUrl}/next-number?utenteId=${utenteLoggato.id}`).subscribe({
      next: (nextNum) => {
        this.updateInvoice({invoiceNumber: nextNum});
      },
      error: (err) => console.error('Errore durante il calcolo del progressivo:', err)
    });
  }

  /**
   * AGGIORNAMENTO PARZIALE E RICALCOLO: Permette di aggiornare solo alcuni campi del preventivo senza sovrascrivere tutto l'oggetto.
   */
  updateInvoice(updates: Partial<InvoiceData>) {
    this.invoice.update(current => {
      const newInvoice = {...current, ...updates};

      // Se le modifiche riguardano righe, IVA o sconto, rifacciamo i conti
      if (updates.items || updates.taxRate !== undefined || updates.discount !== undefined) {
        const itemsToCalc = updates.items || current.items;
        const taxToCalc = updates.taxRate !== undefined ? updates.taxRate : current.taxRate;
        const discountToCalc = updates.discount !== undefined ? updates.discount : current.discount;

        const {subtotal, taxAmount, total} = this.calculateTotals(itemsToCalc, taxToCalc, discountToCalc);

        newInvoice.subtotal = subtotal;
        newInvoice.taxAmount = taxAmount;
        newInvoice.total = total;
      }

      return newInvoice;
    });
  }

  addItem() {
    const newItem: InvoiceItem = {
      id: Date.now().toString(), // Genera un ID temporaneo basato sui millisecondi
      description: '', quantity: 1, unitaMisura: 'pz', rate: 0, amount: 0,
    };
    this.updateInvoice({items: [...this.invoice().items, newItem]});
  }

  removeItem(index: number) {
    const currentItems = this.invoice().items;
    if (currentItems.length > 1) {
      // filter() restituisce un nuovo array escludendo la riga con l'indice specificato
      const newItems = currentItems.filter((_, i) => i !== index);
      this.updateInvoice({items: newItems});
    }
  }

  updateItem(index: number, field: keyof InvoiceItem, value: string | number) {
    const newItems = [...this.invoice().items];
    newItems[index] = {...newItems[index], [field]: value};

    // Calcolo al volo dell'importo della singola riga (Quantità x Prezzo)
    if (field === 'quantity' || field === 'rate') {
      const quantityValue = newItems[index].quantity;
      const rateValue = newItems[index].rate;

      const quantity = typeof quantityValue === 'string' ? (quantityValue === '' ? 0 : Number(quantityValue)) : quantityValue;
      const rate = typeof rateValue === 'string' ? (rateValue === '' ? 0 : Number(rateValue)) : rateValue;

      newItems[index].amount = quantity * rate;
    }

    this.updateInvoice({items: newItems});
  }

  /**
   * SALVATAGGIO: Gestisce intelligentemente la Creazione (POST),
   * la Modifica (PUT) e la funzione "Salva con nome".
   */
  salvaPreventivoNelDb() {
    const data = this.invoice();

    if (!data.invoiceNumber || data.invoiceNumber <= 0) {
      alert('Errore: Inserire un numero di preventivo valido.');
      return;
    }

    if (!data.toName || data.toName.trim() === '') {
      alert('Errore: Inserire il nome del cliente.');
      return;
    }

    // Copia profonda per evitare di modificare inavvertitamente lo stato in memoria
    const preventivoDaSalvare = JSON.parse(JSON.stringify(data));

    const utenteLoggato = this.authService.getUtenteLoggato();
    if (utenteLoggato) {
      preventivoDaSalvare.utenteId = utenteLoggato.id;
    }

    // CAPIRE L'INTENZIONE DELL'UTENTE
    // È una MODIFICA vera e propria solo se l'ID originario coincide con quello attuale.
    const isUpdate = this.originalInvoiceNumber && (this.originalInvoiceNumber === preventivoDaSalvare.invoiceNumber);

    // LOGICA "SALVA CON NOME":
    // L'utente aveva aperto il prev. N°10, ma ha cambiato il numero in 11 per farne uno nuovo.
    // Dobbiamo rigenerare gli ID delle singole righe, altrimenti Hibernate/Spring Boot andrà in errore
    // per violazione di chiavi primarie duplicate.
    if (this.originalInvoiceNumber && this.originalInvoiceNumber !== preventivoDaSalvare.invoiceNumber) {
      preventivoDaSalvare.items.forEach((item: any, index: number) => {
        item.id = Date.now().toString() + '-' + index;
      });
    }

    if (isUpdate) {
      // ---> MODALITÀ MODIFICA (PUT)
      this.http.put<InvoiceData>(`${this.apiUrl}/${preventivoDaSalvare.id}`, preventivoDaSalvare).subscribe({
        next: () => alert('Preventivo aggiornato con successo!'),
        error: (err) => {
          alert('Errore durante l\'aggiornamento: ' + (err.error?.message || 'Errore generico'));
          console.error(err);
        }
      });
    } else {
      // ---> MODALITÀ CREAZIONE O "SALVA CON NOME" (POST)
      this.http.post<InvoiceData>(this.apiUrl, preventivoDaSalvare).subscribe({
        next: () => {
          alert('Nuovo preventivo salvato con successo!');
          this.originalInvoiceNumber = preventivoDaSalvare.invoiceNumber; // Il nuovo numero diventa l'originale
        },
        error: (err) => {
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

  getTuttiIPreventivi() {
    const utenteLoggato = this.authService.getUtenteLoggato();
    const utenteId = utenteLoggato ? utenteLoggato.id : 0;
    return this.http.get<InvoiceData[]>(`${this.apiUrl}?utenteId=${utenteId}`);
  }

  eliminaPreventivoDalDb(id: number) {
    // 1. Recupera i dati dell'utente loggato dal servizio Auth
    const utenteLoggato = this.authService.getUtenteLoggato();
    // recuperiamo l'ID dell'utente loggato se esiste altrimenti 0
    const utenteId = utenteLoggato ? utenteLoggato.id : 0;

    // 2. Aggiunge l'utenteId come parametro URL nella richiesta DELETE
    return this.http.delete(`${this.apiUrl}/${id}?utenteId=${utenteId}`);
  }

  resetInvoice() {
    this.originalInvoiceNumber = null;
    this.invoice.set({...this.initialData});
  }

  /**
   * Carica un documento dalla lista Archivio per la visualizzazione/modifica.
   * Utilizza il JSON.parse(JSON.stringify) per "scollegare" l'oggetto in memoria,
   * evitando che modificando il preventivo si aggiornino involontariamente le scritte in tabella.
   */
  caricaPreventivoPerModifica(prev: InvoiceData) {
    this.originalInvoiceNumber = prev.invoiceNumber;
    this.invoice.set(JSON.parse(JSON.stringify(prev)));
  }

  /**
   * Logica matematica di base del documento: Imponibile + IVA - Sconto
   */
  private calculateTotals(items: InvoiceItem[], taxRate: number | string, discount: number = 0) {
    const subtotal = items.reduce((sum, item) => {
      const amount = typeof item.amount === 'number' ? item.amount : 0;
      return sum + amount;
    }, 0);

    const rate = typeof taxRate === 'number' ? taxRate : taxRate === '' ? 0 : Number(taxRate);
    const taxAmount = (subtotal * rate) / 100;

    const discountVal = typeof discount === 'number' ? discount : Number(discount) || 0;
    const total = (subtotal + taxAmount) - discountVal;

    return {subtotal, taxAmount, total};
  }
}
