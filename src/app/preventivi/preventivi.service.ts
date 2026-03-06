import {inject, Injectable, signal} from '@angular/core';
import {InvoiceData, InvoiceItem} from './preventivi.model';
import {HttpClient} from '@angular/common/http';
import {Auth} from '../auth/auth';
import {debounceTime, Observable, Subject} from 'rxjs';
import Swal from 'sweetalert2';

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
  // cercando proprietà (come invoice().date) non ancora definite.
  invoice = signal<InvoiceData>({
    invoiceNumber: null,
    date: new Date().toISOString().split('T')[0],
    fromName: '', fromEmail: '', fromPiva: '',
    toName: '', toEmail: '', toPiva: '',
    items: [{id: Date.now().toString(), description: '', unitaMisura: 'pz', quantity: 1, rate: 0, amount: 0}],
    taxRate: 22, subtotal: 0, taxAmount: 0, discount: 0, total: 0
  });

  //  Signal per gestire l'icona, serve per tenere traccia se ci sono modifiche non salvate.
  hasUnsavedChanges = signal(false);

  private http = inject(HttpClient);
  private authService = inject(Auth);
  private apiUrl = 'http://localhost:8080/api/preventivi';
  // creaiamo un subject per il salvataggio automatico
  private autoSaveSubject = new Subject<void>();

  constructor() {
    // 2. IL COSTRUTTORE ESEGUE LA PRECOMPILAZIONE
    // Appena il servizio viene creato (e authService è sicuramente pronto),
    // aggiorniamo il preventivo con i dati dell'utente chiamando resetInvoice().
    this.resetInvoice();

    // ascolto del salvataggio automatico, dopo 1 minuto si attiva automaticamente
    this.autoSaveSubject.pipe(
      debounceTime(60000)
    ).subscribe(() => {
      this.eseguiAutoSalvataggioSilenzioso();
    });
  }

  ottieniProssimoNumero() {
    const utenteLoggato = this.authService.getUtenteLoggato();
    if (!utenteLoggato) return;

    this.http.get<number>(`${this.apiUrl}/next-number?utenteId=${utenteLoggato.id}`).subscribe({
      next: (nextNum) => {
        // vecchia versione che chiamava il metodo updateInvoice() e faceva scattare la nuvoletta rossa (hasUnsavedChanges)
        //this.updateInvoice({invoiceNumber: nextNum});

        // Modifichiamo direttamente il Signal senza chiamare this.updateInvoice()
        // In questo modo NON scatta la nuvoletta rossa (hasUnsavedChanges)
        this.invoice.update(current => ({...current, invoiceNumber: nextNum}));
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

    // Segnala che ci sono modifiche non salvate (nuvoletta rossa)
    this.hasUnsavedChanges.set(true);

    // 2. Lancia il trigger per l'autosalvataggio (implementato prima)
    this.autoSaveSubject.next();
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
      Swal.fire('Attenzione', 'Inserire un numero di preventivo valido.', 'warning');
      return;
    }

    if (!data.toName || data.toName.trim() === '') {
      Swal.fire('Attenzione', 'Inserire il nome del cliente.', 'warning');
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

    if (isUpdate && preventivoDaSalvare.id !== undefined) {
      this.http.put<InvoiceData>(`${this.apiUrl}/${preventivoDaSalvare.id}`, preventivoDaSalvare).subscribe({
        next: () => {
          Swal.fire({
            title: 'Aggiornato!',
            text: 'Preventivo aggiornato con successo!',
            icon: 'success',
            timer: 1000, // Si chiude da solo dopo 1.5 secondi!
            showConfirmButton: false
          });
          this.hasUnsavedChanges.set(false);
        },
        error: (err) => {
          Swal.fire('Errore', 'Errore durante l\'aggiornamento: ' + (err.error?.message || 'Errore generico'), 'error');
          console.error(err);
        }
      });
    } else {
      this.http.post<InvoiceData>(this.apiUrl, preventivoDaSalvare).subscribe({
        next: (rispostaDb: any) => {
          Swal.fire({
            title: 'Salvato!',
            text: 'Nuovo preventivo salvato con successo!',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
          this.originalInvoiceNumber = preventivoDaSalvare.invoiceNumber;
          this.invoice.update(current => ({...current, id: rispostaDb.id}));
          this.hasUnsavedChanges.set(false);
        },
        error: (err) => {
          if (err.status === 409) {
            Swal.fire('Numero duplicato', 'Il numero preventivo "' + preventivoDaSalvare.invoiceNumber + '" è già utilizzato.', 'warning');
          } else {
            Swal.fire('Errore', 'Errore durante il salvataggio: ' + (err.error?.message || 'Errore generico'), 'error');
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
    // Ora usiamo il metodo sicuro che pesca i dati freschi dell'utente
    this.invoice.set(this.creaDatiIniziali());
    this.hasUnsavedChanges.set(false);
  }

  /**
   * Carica un documento dalla lista Archivio per la visualizzazione/modifica.
   * Utilizza il JSON.parse(JSON.stringify) per "scollegare" l'oggetto in memoria,
   * evitando che modificando il preventivo si aggiornino involontariamente le scritte in tabella.
   */
  caricaPreventivoPerModifica(prev: InvoiceData) {
    this.originalInvoiceNumber = prev.invoiceNumber;
    this.invoice.set(JSON.parse(JSON.stringify(prev)));
    this.hasUnsavedChanges.set(false);
  }

  /**
   * Sincronizza silenziosamente i dati dell'emittente con quelli attuali del LocalStorage.
   * Essendo "silenzioso" (non aggiorna hasUnsavedChanges), non fa scattare
   * la nuvoletta rossa appena apri la pagina.
   */
  allineaDatiEmittenteSilenzioso() {
    const utente = this.authService.getUtenteLoggato();

    if (utente) {
      this.invoice.update(current => ({
        ...current,
        fromName: utente.nomeAzienda || utente.nome || '',
        fromEmail: utente.email || '',
        fromPiva: utente.partitaIva || ''
      }));
    }
  }

  /* metodo per utilizzare l'API del linguaggio AI per generare una descrizione voce preventivo accurata*/
  miglioraDescrizioneConIA(testoBreve: string): Observable<any> {
    return this.http.post<any>('http://localhost:8080/api/ai/genera-descrizione', {testo: testoBreve});
  }

  /**
   * Riordina le voci tramite Drag & Drop
   */
  riordinaItem(daIndice: number, aIndice: number) {
    const newItems = [...this.invoice().items];

    // Rimuove l'elemento dalla sua posizione originale
    const [itemSpostato] = newItems.splice(daIndice, 1);

    // Lo inserisce nella nuova posizione
    newItems.splice(aIndice, 0, itemSpostato);

    // Aggiorna il preventivo
    this.updateInvoice({items: newItems});
  }

  /**
   * Genera un preventivo vuoto ma precompilato con i dati dell'utente loggato
   */
  private creaDatiIniziali(): InvoiceData {
    let utente = null;
    try {
      // Recuperiamo i dati dell'utente in modo sicuro
      utente = this.authService.getUtenteLoggato();
    } catch (error) {
      console.error("Errore nel recupero dei dati utente", error);
    }

    return {
      invoiceNumber: null,
      date: new Date().toISOString().split('T')[0], // Data di oggi (YYYY-MM-DD)

      // PRECOMPILAZIONE AUTOMATICA:
      // Se esiste nomeAzienda usa quello, altrimenti usa il nome normale, altrimenti vuoto
      fromName: utente?.nomeAzienda || utente?.nome || '',
      fromEmail: utente?.email || '',
      fromPiva: utente?.partitaIva || '',

      // Il resto rimane vuoto
      toName: '', toEmail: '', toPiva: '',
      items: [{id: Date.now().toString(), description: '', unitaMisura: 'pz', quantity: 1, rate: 0, amount: 0}],
      taxRate: 22, subtotal: 0, taxAmount: 0, discount: 0, total: 0
    };
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

// Metodo per salvare automaticamente il preventivo in modo silenzioso
  private eseguiAutoSalvataggioSilenzioso() {
    const data = this.invoice();

    // Validazione silenziosa: se mancano i dati minimi, ignoriamo il salvataggio
    if (!data.invoiceNumber || data.invoiceNumber <= 0) return;
    if (!data.toName || data.toName.trim() === '') return;

    const preventivoDaSalvare = JSON.parse(JSON.stringify(data));
    const utenteLoggato = this.authService.getUtenteLoggato();
    if (utenteLoggato) preventivoDaSalvare.utenteId = utenteLoggato.id;

    const isUpdate = this.originalInvoiceNumber && (this.originalInvoiceNumber === preventivoDaSalvare.invoiceNumber);

    // Gestione id righe
    if (this.originalInvoiceNumber && this.originalInvoiceNumber !== preventivoDaSalvare.invoiceNumber) {
      preventivoDaSalvare.items.forEach((item: any, index: number) => {
        item.id = Date.now().toString() + '-' + index;
      });
    }

    if (isUpdate && preventivoDaSalvare.id) {
      this.http.put<InvoiceData>(`${this.apiUrl}/${preventivoDaSalvare.id}`, preventivoDaSalvare).subscribe({
        next: () => {
          console.log('Auto-salvataggio: preventivo aggiornato.');
          // Torna la nuvoletta verde!
          this.hasUnsavedChanges.set(false);
        },
        error: (err) => console.error('Errore auto-salvataggio', err)
      });
    } else {
      this.http.post<InvoiceData>(this.apiUrl, preventivoDaSalvare).subscribe({
        next: (rispostaDb: any) => {
          console.log('Auto-salvataggio: nuovo preventivo creato.');
          this.originalInvoiceNumber = rispostaDb.invoiceNumber;
          this.invoice.update(current => ({...current, id: rispostaDb.id}));

          // Torna la nuvoletta verde!
          this.hasUnsavedChanges.set(false);
        },
        error: (err) => console.error('Errore auto-salvataggio creazione', err)
      });
    }
  }
}
