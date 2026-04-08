export interface Pezzo {
  id?: string;
  nome: string;
  larghezza: number;
  altezza: number;
  quantita: number;
  puoRuotare: boolean;
  indiceColore?: number;

  // Proprietà calcolate dall'algoritmo (opzionali in fase di input)
  x?: number;
  y?: number;
  larghezzaTaglio?: number; // (larghezza finale calcolando la rotazione)
  altezzaTaglio?: number;   // (altezza finale calcolando la rotazione)
  ruotato?: boolean;
  posizionato?: boolean;
}

export interface RisultatoPannello {
  pannelloLarghezza: number;
  pannelloAltezza: number;
  pezzi: Pezzo[];
  nonPosizionabili?: Pezzo[];
}

export interface RisultatoOttimizzazione {
  pannelli: RisultatoPannello[];
  efficienza: number;
  areaUsata: number;
  areaScarto: number;
}
