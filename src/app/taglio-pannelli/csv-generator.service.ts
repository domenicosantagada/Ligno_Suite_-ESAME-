import {Injectable} from '@angular/core';
import {Pezzo} from './taglio-pannelli.model';

/**
 * Interfaccia per raggruppare le impostazioni base del pannello lette/scritte nel CSV
 */
export interface ImpostazioniCSV {
  pannelloAltezza: number;
  pannelloLarghezza: number;
  spessoreLama: number;
  marginePannello: number;
}

/**
 * Interfaccia per restituire al componente i dati completi estratti dal file
 */
export interface DatiImportatiCSV {
  impostazioni: ImpostazioniCSV;
  pezzi: Pezzo[];
}

@Injectable({
  providedIn: 'root'
})
export class CsvGeneratorService {

  /**
   * Genera una stringa CSV partendo dai dati forniti e fa partire il download nel browser.
   */
  public esportaCSV(impostazioni: ImpostazioniCSV, pezzi: Pezzo[]): void {
    const separatore = ';';
    let csv = '';

    // --- BLOCCO 1: Impostazioni Generali ---
    csv += 'IMPOSTAZIONI PANNELLO\n';
    csv += `Altezza (mm)${separatore}Larghezza (mm)${separatore}Spessore Lama (mm)${separatore}Margine (mm)\n`;
    csv += `${impostazioni.pannelloAltezza}${separatore}${impostazioni.pannelloLarghezza}${separatore}${impostazioni.spessoreLama}${separatore}${impostazioni.marginePannello}\n\n`;

    // --- BLOCCO 2: Distinta dei Pezzi ---
    csv += 'DISTINTA PEZZI\n';
    csv += `Descrizione${separatore}Altezza (mm)${separatore}Larghezza (mm)${separatore}Quantita${separatore}Rotazione\n`;

    pezzi.forEach(p => {
      const rotazione = p.puoRuotare ? 'Si' : 'No';
      let nomePulito = p.nome || '';
      // Pulizia testo per evitare rotture del CSV
      nomePulito = nomePulito.replace(/(\r\n|\n|\r)/gm, " ").replace(/;/g, ",");
      csv += `${nomePulito}${separatore}${p.altezza}${separatore}${p.larghezza}${separatore}${p.quantita}${separatore}${rotazione}\n`;
    });

    // Creazione del Blob e avvio download
    const blob = new Blob(["\ufeff", csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const oggi = new Date().toLocaleDateString('it-IT').replace(/\//g, '-');
    link.setAttribute('download', `Distinta_Taglio_${oggi}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Apre la finestra di selezione file del sistema operativo, legge il file e ne estrae i dati.
   * Restituisce una Promise con i dati estratti per farli gestire al componente.
   */
  public importaCSV(): Promise<DatiImportatiCSV> {
    return new Promise((resolve, reject) => {
      const inputNode = document.createElement('input');
      inputNode.type = 'file';
      inputNode.accept = '.csv';

      inputNode.addEventListener('change', (event: any) => {
        const file = event.target.files[0];
        if (!file) {
          reject(new Error("Nessun file selezionato"));
          return;
        }

        const reader = new FileReader();

        reader.onload = (e: any) => {
          try {
            const text = e.target.result;
            const datiEstratti = this.processaTestoCSV(text);
            resolve(datiEstratti);
          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = () => reject(new Error("Errore durante la lettura del file dal disco"));
        reader.readAsText(file);
      });

      // Avvia la selezione file
      inputNode.click();
    });
  }

  /**
   * Motore interno che converte il testo puro del CSV in oggetti TypeScript
   */
  private processaTestoCSV(csvText: string): DatiImportatiCSV {
    const pezziEstratti: Pezzo[] = [];
    const impostazioniEstratte: ImpostazioniCSV = {
      pannelloAltezza: 0,
      pannelloLarghezza: 0,
      spessoreLama: 0,
      marginePannello: 0
    };

    let testoPulito = csvText.replace(/^\uFEFF/, '').trim();
    const righe = testoPulito.split(/\r?\n/);

    if (righe.length < 6) {
      throw new Error('Il file non contiene righe sufficienti per essere valido.');
    }

    // Lettura Impostazioni
    const datiPannello = righe[2].split(';');
    if (datiPannello.length >= 4) {
      impostazioniEstratte.pannelloAltezza = Number(datiPannello[0]) || 0;
      impostazioniEstratte.pannelloLarghezza = Number(datiPannello[1]) || 0;
      impostazioniEstratte.spessoreLama = Number(datiPannello[2]) || 0;
      impostazioniEstratte.marginePannello = Number(datiPannello[3]) || 0;
    }

    // Lettura Pezzi
    let startIndexPezzi = 6;
    for (let i = 0; i < righe.length; i++) {
      if (righe[i].startsWith('Descrizione;Altezza')) {
        startIndexPezzi = i + 1;
        break;
      }
    }

    for (let i = startIndexPezzi; i < righe.length; i++) {
      const riga = righe[i].trim();
      if (!riga) continue;

      const colonne = riga.split(';');
      if (colonne.length >= 5) {
        pezziEstratti.push({
          nome: colonne[0],
          altezza: Number(colonne[1]) || 0,
          larghezza: Number(colonne[2]) || 0,
          quantita: Number(colonne[3]) || 1,
          puoRuotare: colonne[4].trim().toLowerCase() === 'si'
        });
      }
    }

    return {impostazioni: impostazioniEstratte, pezzi: pezziEstratti};
  }
}
