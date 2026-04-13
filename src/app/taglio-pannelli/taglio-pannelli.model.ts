/**
 * Rappresenta un singolo pezzo da tagliare.
 *
 * Contiene sia i dati di input (definiti dall'utente),
 * sia le proprietà calcolate dall'algoritmo di ottimizzazione.
 */
export interface Pezzo {

  /** Identificativo univoco lato frontend (opzionale, non persistente) */
  id?: string;

  /** Nome descrittivo del pezzo */
  nome: string;

  /** Dimensioni originali del pezzo (prima di eventuale rotazione) */
  larghezza: number;
  altezza: number;

  /** Numero di occorrenze richieste */
  quantita: number;

  /** Indica se il pezzo può essere ruotato di 90° durante il posizionamento */
  puoRuotare: boolean;

  /** Indice per la gestione del colore in fase di rendering */
  indiceColore?: number;

  // -----------------------------
  // Proprietà calcolate (output algoritmo)
  // -----------------------------

  /** Coordinata X del pezzo posizionato nel pannello */
  x?: number;

  /** Coordinata Y del pezzo posizionato nel pannello */
  y?: number;

  /** Larghezza effettiva dopo eventuale rotazione */
  larghezzaTaglio?: number;

  /** Altezza effettiva dopo eventuale rotazione */
  altezzaTaglio?: number;

  /** Indica se il pezzo è stato ruotato rispetto all'orientamento originale */
  ruotato?: boolean;

  /** Flag che indica se il pezzo è stato effettivamente posizionato */
  posizionato?: boolean;
}

/**
 * Rappresenta un singolo pannello lavorato.
 *
 * Contiene i pezzi posizionati, eventuali scarti e pezzi non collocabili.
 */
export interface RisultatoPannello {

  /** Dimensioni del pannello di partenza */
  pannelloLarghezza: number;
  pannelloAltezza: number;

  /** Lista dei pezzi effettivamente posizionati nel pannello */
  pezzi: Pezzo[];

  /** Pezzi che non è stato possibile collocare (overflow o vincoli) */
  nonPosizionabili?: Pezzo[];

  /** Aree residue non utilizzate (scarti) */
  scarti?: Scarto[];
}

/**
 * Risultato complessivo dell'ottimizzazione.
 *
 * Aggrega più pannelli e metriche globali di efficienza.
 */
export interface RisultatoOttimizzazione {

  /** Collezione dei pannelli generati dall'algoritmo */
  pannelli: RisultatoPannello[];

  /** Efficienza globale (tipicamente areaUsata / areaTotale) */
  efficienza: number;

  /** Area totale occupata dai pezzi */
  areaUsata: number;

  /** Area totale non utilizzata (somma degli scarti) */
  areaScarto: number;
}

/**
 * Rappresenta un'area rettangolare di scarto all'interno del pannello.
 */
export interface Scarto {

  /** Coordinata X dell'area di scarto */
  x: number;

  /** Coordinata Y dell'area di scarto */
  y: number;

  /** Larghezza dell'area di scarto */
  w: number;

  /** Altezza dell'area di scarto */
  h: number;
}
