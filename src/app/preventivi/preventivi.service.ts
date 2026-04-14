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
    // Appena il servizio viene creato
    // aggiorniamo il preventivo con i dati dell'utente chiamando resetInvoice().
    this.resetInvoice();

    // ascolto del salvataggio automatico, dopo 1 minuto si attiva automaticamente
    this.autoSaveSubject.pipe(
      debounceTime(60000)
    ).subscribe(() => {
      this.eseguiAutoSalvataggioSilenzioso();
    });
  }


  /**
   * CALCOLO PROGRESSIVO: Fa una chiamata GET al backend per ottenere il prossimo numero disponibile.
   * Il backend calcola il numero progressivo in modo sicuro, evitando conflitti tra più utenti.
   * Una volta ottenuto, aggiorna il campo "invoiceNumber" del preventivo.
   */
  ottieniProssimoNumero() {

    // Chiamata GET al backend per ottenere il prossimo numero progressivo disponibile
    this.http.get<number>(`${this.apiUrl}/next-number`).subscribe({
      next: (nextNum) => {
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

    // Validazioni base
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


    /**
     * Determina il tipo di operazione richiesta dall'utente.
     *
     * - UPDATE: esiste un preventivo già persistito e il numero non è stato modificato
     * - CLONE ("Salva con nome"): esiste un preventivo originale ma il numero è stato cambiato
     * - CREATE: nuovo preventivo senza riferimento a uno esistente
     */
    const isUpdate = this.originalInvoiceNumber && (this.originalInvoiceNumber === preventivoDaSalvare.invoiceNumber);

    /**
     * NORMALIZZAZIONE DEGLI IDENTIFICATORI PER JPA/HIBERNATE
     *
     * Obiettivo: evitare inconsistenze nello stato delle entità (es. "detached entity")
     * e guidare correttamente il comportamento di persistenza (INSERT vs UPDATE).
     */
    if (this.originalInvoiceNumber && this.originalInvoiceNumber !== preventivoDaSalvare.invoiceNumber) {
      /**
       * CASO: CLONE DEL PREVENTIVO ("Salva con nome")
       *
       * Il cambio del numero identifica semanticamente una nuova entità.
       * È quindi necessario azzerare tutti gli identificatori per forzare Hibernate
       * a trattare sia il parent che le relazioni come nuove entità (INSERT).
       */
      preventivoDaSalvare.id = null;

      preventivoDaSalvare.items.forEach((item: any) => {
        item.id = null; // forza INSERT anche per le entità figlie
      });

    } else {
      /**
       * CASO: CREATE o UPDATE STANDARD
       *
       * - Gli item con ID numerico sono considerati persistiti → UPDATE
       * - Gli item con ID temporaneo (stringhe generate lato client) devono essere
       *   convertiti in null per essere riconosciuti come nuove entità → INSERT
       */
      preventivoDaSalvare.items.forEach((item: any) => {
        if (typeof item.id === 'string') {
          item.id = null; // segnala a JPA che l'entità è nuova
        }
      });
    }

    /**
     * ESECUZIONE DELLA CHIAMATA HTTP CORRETTA IN BASE AL CONTESTO:
     *
     * - UPDATE: PUT all'endpoint /api/preventivi/{id} con il DTO completo
     * - CREATE: POST all'endpoint /api/preventivi con il DTO completo
     */
    if (isUpdate && preventivoDaSalvare.id !== undefined) {
      // CHIAMATA PUT (Aggiornamento)
      // Passiamo utenteId come parametro URL (?utenteId=...)
      this.http.put<InvoiceData>(`${this.apiUrl}/${preventivoDaSalvare.id}`, preventivoDaSalvare).subscribe({
        next: () => {
          Swal.fire({
            title: 'Aggiornato!',
            text: 'Preventivo aggiornato con successo!',
            icon: 'success',
            timer: 1000, // Si chiude da solo dopo 1 secondo!
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
      // CHIAMATA POST (Creazione nuovo)
      // Passiamo utenteId come parametro URL (?utenteId=...)
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

          // Aggiorniamo lo stato interno con l'ID REALE generato dal database
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

  /**
   * ARCHIVIO PREVENTIVI: Recupera la lista dei preventivi associati all'utente loggato.
   * Il backend filtra i preventivi in base all'utente, quindi riceviamo solo quelli pertinenti.
   */
  getTuttiIPreventivi() {
    return this.http.get<InvoiceData[]>(this.apiUrl);
  }

  /**
   * ARCHIVIO PREVENTIVI PER CLIENTE: Recupera la lista dei preventivi associati a un cliente specifico (filtro per email).
   * Il backend gestisce il filtro, restituendo solo i preventivi che corrispondono all'email del cliente.
   */
  getPreventiviPerCliente(email: string) {
    return this.http.get<InvoiceData[]>(`${this.apiUrl}/cliente?email=${email}`);
  }

  /**
   * ELIMINAZIONE: Elimina un preventivo specifico. Il backend verifica che il preventivo appartenga all'utente loggato prima di eliminarlo.
   */
  eliminaPreventivoDalDb(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /**
   * RESET DEL PREVENTIVO: Pulisce il form per creare un nuovo preventivo, azzerando i dati e resettando lo stato.
   */
  resetInvoice() {
    this.originalInvoiceNumber = null;
    // Ora usiamo il metodo sicuro che pesca i dati freschi dell'utente
    this.invoice.set(this.creaDatiIniziali());
    this.hasUnsavedChanges.set(false);
  }

  /**
   * Carica un documento dalla lista Archivio per la visualizzazione/modifica.
   * Fa una chiamata GET per scaricare il DTO COMPLETO (con la lista degli items).
   */
  caricaPreventivoPerModifica(prev: any) {
    // 1. Usiamo l'ID del preventivo riassuntivo per scaricare quello completo
    this.http.get<InvoiceData>(`${this.apiUrl}/${prev.id}`).subscribe({
      next: (prevCompleto) => {
        // 2. Impostiamo i dati completi nel form
        this.originalInvoiceNumber = prevCompleto.invoiceNumber;
        this.invoice.set(prevCompleto);
        this.hasUnsavedChanges.set(false);
      },
      error: (err) => {
        console.error('Errore nel caricamento dei dettagli del preventivo:', err);
      }
    });
  }

  /**
   * Sincronizza silenziosamente i dati dell'emittente con quelli attuali del LocalStorage.
   * non fa scattare l'evento di modifiche non salvate.
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

  inviaPdfPerEmail(formData: FormData) {
    return this.http.post('http://localhost:8080/api/email/invia-preventivo', formData);
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
    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);

    const rate = typeof taxRate === 'number' ? taxRate : taxRate === '' ? 0 : Number(taxRate);
    const taxAmount = (subtotal * rate) / 100;

    const discountVal = Number(discount) || 0;
    const total = (subtotal + taxAmount) - discountVal;

    return {subtotal, taxAmount, total};
  }

  /**
   * Esegue un salvataggio silenzioso del preventivo in background, senza mostrare notifiche all'utente.
   * Viene attivato automaticamente ogni minuto se ci sono modifiche non salvate.
   * Il salvataggio avviene solo se il preventivo ha un numero valido e un nome cliente, per evitare di creare bozze inutili.
   * Se è un nuovo preventivo (senza originalInvoiceNumber), viene creato un nuovo record. Se è una modifica, viene aggiornato quello esistente.
   */
  private eseguiAutoSalvataggioSilenzioso() {
    const data = this.invoice();

    if (!data.invoiceNumber || data.invoiceNumber <= 0) return;
    if (!data.toName || data.toName.trim() === '') return;

    const preventivoDaSalvare = JSON.parse(JSON.stringify(data));
    const isUpdate = this.originalInvoiceNumber && (this.originalInvoiceNumber === preventivoDaSalvare.invoiceNumber);

    if (this.originalInvoiceNumber && this.originalInvoiceNumber !== preventivoDaSalvare.invoiceNumber) {
      preventivoDaSalvare.items.forEach((item: any, index: number) => {
        item.id = Date.now().toString() + '-' + index;
      });
    }

    /**
     * Logica di salvataggio identica a quella del metodo salvaPreventivoNelDb(), ma senza notifiche.
     * La sicurezza è gestita dall'Interceptor che aggiunge l'utenteId a tutte le chiamate, quindi non serve passarlo esplicitamente.
     */
    if (isUpdate && preventivoDaSalvare.id) {
      // PUT senza parametri URL (sicurezza gestita dall'Interceptor)
      this.http.put<InvoiceData>(`${this.apiUrl}/${preventivoDaSalvare.id}`, preventivoDaSalvare).subscribe({
        next: () => {
          console.log('Auto-salvataggio: preventivo aggiornato.');
          this.hasUnsavedChanges.set(false);
        },
        error: (err) => console.error('Errore auto-salvataggio', err)
      });
    } else {
      // POST senza parametri URL (sicurezza gestita dall'Interceptor)
      this.http.post<InvoiceData>(this.apiUrl, preventivoDaSalvare).subscribe({
        next: (rispostaDb: any) => {
          console.log('Auto-salvataggio: nuovo preventivo creato.');
          this.originalInvoiceNumber = rispostaDb.invoiceNumber;
          this.invoice.update(current => ({...current, id: rispostaDb.id}));
          this.hasUnsavedChanges.set(false);
        },
        error: (err) => console.error('Errore auto-salvataggio creazione', err)
      });
    }
  }
}
