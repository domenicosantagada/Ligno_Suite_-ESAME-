/**
 * FILE DI MODELLO (Model)
 * Questo file contiene le "Interfacce" (Interfaces).
 * Serve a spiegare a TypeScript come è fatto esattamente un oggetto.
 */

/**
 * Rappresenta una SINGOLA RIGA (voce) all'interno della tabella del preventivo.
 */
export interface InvoiceItem {
  id: string; // ID temporaneo generato dal frontend (serve per distinguere le righe quando le aggiungi/rimuovi)
  description: string; // La descrizione del lavoro o del prodotto

  // Usiamo "number | string" (Unione di tipi) perché i campi input HTML
  // a volte passano i numeri sotto forma di testo prima del calcolo.
  quantity: number | string;
  unitaMisura: string; // Es. 'pz', 'mq', 'h'
  rate: number | string; // Prezzo unitario

  amount: number; // Importo totale della riga (quantità * prezzo unitario)
}

/**
 * Rappresenta l'INTERO DOCUMENTO (il Preventivo completo).
 */
export interface InvoiceData {

  // Il punto interrogativo "?" rende la proprietà OPZIONALE.
  // Se stiamo creando un NUOVO preventivo, l'ID non esiste ancora (lo assegnerà il Database al salvataggio).
  id?: number;

  invoiceNumber: number | null; // Numero progressivo. "null" se è un documento appena aperto e non ancora numerato.
  date: string; // Data di emissione (salvata come stringa, solitamente "YYYY-MM-DD")

  // --- DATI EMITTENTE (La tua falegnameria) ---
  fromName: string;
  fromEmail: string;
  fromPiva?: string;

  // --- DATI CLIENTE (A chi mandi il preventivo) ---
  toName: string;
  toEmail: string;
  toPiva?: string;

  // --- CORPO DEL DOCUMENTO ---
  // Array ("[]") che contiene una lista di oggetti di tipo InvoiceItem (definito qui sopra).
  items: InvoiceItem[];

  // --- CALCOLI E TOTALI ---
  taxRate: number | string; // Percentuale IVA (es. 22)
  subtotal: number; // Imponibile (somma di tutte le righe)
  taxAmount: number; // Valore dell'IVA in Euro
  discount: number; // Sconto applicato in Euro
  total: number; // Totale finale (Imponibile + IVA - Sconto)

  // Campo opzionale per memorizzare informazioni sull'utente (falegnameria) che ha creato il preventivo.
  utente?: { id: number; logoBase64?: string; nomeAzienda?: string };

  // --- RELAZIONI DEL DATABASE ---
  // Collega questo preventivo all'ID del tuo account utente.
  // È opzionale perché viene valorizzato dal Service un attimo prima di salvare nel DB.
  utenteId?: number;
}
