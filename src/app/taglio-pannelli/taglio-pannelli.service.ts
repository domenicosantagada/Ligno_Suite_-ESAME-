import {Injectable} from '@angular/core';
import {Pezzo, RisultatoOttimizzazione, RisultatoPannello, Scarto} from './taglio-pannelli.model';

@Injectable({
  providedIn: 'root'
})
export class TaglioPannelliService {

  constructor() {
  }

  // Metodo principale chiamato dal componente
  public ottimizzaTaglio(larghezzaPannello: number, altezzaPannello: number, spessoreLama: number, margine: number, pezziInput: Pezzo[]): RisultatoOttimizzazione {
    const espansi: Pezzo[] = [];

    // 1. Espande i pezzi in base alla quantità
    pezziInput.forEach((p, idx) => {
      for (let q = 0; q < p.quantita; q++) {
        espansi.push({
          id: `${idx}-${q}`,
          nome: p.nome || `P${idx + 1}`,
          larghezza: p.larghezza,
          altezza: p.altezza,
          quantita: 1,
          puoRuotare: p.puoRuotare,
          indiceColore: idx
        });
      }
    });

    // 2. Strategie di ordinamento (Euristiche)
    const strategieOrdinamento = [
      (a: Pezzo, b: Pezzo) => (b.larghezza * b.altezza) - (a.larghezza * a.altezza), // Area decrescente
      (a: Pezzo, b: Pezzo) => Math.max(b.larghezza, b.altezza) - Math.max(a.larghezza, a.altezza), // Lato più lungo
      (a: Pezzo, b: Pezzo) => (b.larghezza + b.altezza) - (a.larghezza + a.altezza) // Perimetro decrescente
    ];

    let migliorRisultato: RisultatoOttimizzazione | null = null;

    // 3. Testiamo tutte le combinazioni
    for (const strategia of strategieOrdinamento) {
      for (const taglioVerticale of [true, false]) {

        const pezziCorrenti = [...espansi].sort(strategia);
        const risultato = this.eseguiSingolaOttimizzazione(larghezzaPannello, altezzaPannello, spessoreLama, margine, pezziCorrenti, taglioVerticale);

        if (!migliorRisultato ||
          risultato.pannelli.length < migliorRisultato.pannelli.length ||
          (risultato.pannelli.length === migliorRisultato.pannelli.length && risultato.efficienza > migliorRisultato.efficienza)) {
          migliorRisultato = risultato;
        }
      }
    }

    return migliorRisultato!;
  }

  // --- Esecuzione del singolo tentativo di ottimizzazione ---
  private eseguiSingolaOttimizzazione(larghezzaPannello: number, altezzaPannello: number, spessoreLama: number, margine: number, listaPezzi: Pezzo[], taglioVerticale: boolean): RisultatoOttimizzazione {
    const pannelloRef = {w: larghezzaPannello, h: altezzaPannello};
    const pannelli: RisultatoPannello[] = [];
    let rimanenti = [...listaPezzi];

    while (rimanenti.length > 0) {
      // ORA RECUPERIAMO SIA I PEZZI CHE GLI SCARTI DALLA GHIGLIOTTINA
      const risultatoTaglio = this.taglioGhigliottina(pannelloRef, rimanenti, spessoreLama, margine, taglioVerticale);

      const posizionatiSulPannello = risultatoTaglio.posizionati.filter(p => p.posizionato);
      const nonPosizionati = risultatoTaglio.posizionati.filter(p => !p.posizionato);

      // Filtriamo gli scarti troppo piccoli (es. strisce sotto i 2cm) per evitare che il canvas si riempia di "polvere" visiva
      const scartiUtili = risultatoTaglio.scarti.filter(s => s.w > 20 && s.h > 20);

      const risultatoPannello: RisultatoPannello = {
        pezzi: posizionatiSulPannello,
        pannelloLarghezza: larghezzaPannello,
        pannelloAltezza: altezzaPannello,
        scarti: scartiUtili // <-- GLI SCARTI VENGONO INSERITI QUI!
      };

      if (nonPosizionati.length === rimanenti.length) {
        risultatoPannello.nonPosizionabili = nonPosizionati;
        pannelli.push(risultatoPannello);
        break;
      }

      pannelli.push(risultatoPannello);
      rimanenti = nonPosizionati;
    }

    const areaTotalePannelli = pannelli.length * larghezzaPannello * altezzaPannello;

    let areaUsata = 0;
    pannelli.forEach(pnl => {
      pnl.pezzi.forEach(p => {
        areaUsata += (p.larghezzaTaglio || 0) * (p.altezzaTaglio || 0);
      });
    });

    const efficienza = areaTotalePannelli > 0 ? (areaUsata / areaTotalePannelli) * 100 : 0;

    return {
      pannelli,
      efficienza,
      areaUsata,
      areaScarto: areaTotalePannelli - areaUsata
    };
  }

  // --- Algoritmo Guillotine con Regola di Split dinamica ---
  // MODIFICATO IL TIPO DI RITORNO: restituisce un oggetto con { posizionati, scarti }
  private taglioGhigliottina(pannello: {
    w: number,
    h: number
  }, listaPezzi: Pezzo[], spessoreLama: number, margine: number, taglioVerticale: boolean): {
    posizionati: Pezzo[],
    scarti: Scarto[]
  } {
    const spaziLiberi: Scarto[] = [{
      x: margine, y: margine, w: pannello.w - 2 * margine, h: pannello.h - 2 * margine
    }];
    const posizionati: Pezzo[] = [];

    const puoEntrare = (rect: any, pw: number, ph: number) => pw <= rect.w && ph <= rect.h;

    const calcolaPunteggio = (rect: any, pw: number, ph: number) => {
      const area = rect.w * rect.h - pw * ph;
      const latoCorto = Math.min(rect.w - pw, rect.h - ph);
      return {area, latoCorto};
    };

    for (const pezzo of listaPezzi) {
      let migliorPunteggio: any = null;
      let migliorSpazio: any = null;
      let rotazioneMigliore = false;
      let indiceMigliore = -1;

      for (let i = 0; i < spaziLiberi.length; i++) {
        const spazio = spaziLiberi[i];

        if (puoEntrare(spazio, pezzo.larghezza, pezzo.altezza)) {
          const s = calcolaPunteggio(spazio, pezzo.larghezza, pezzo.altezza);
          if (!migliorPunteggio || s.area < migliorPunteggio.area || (s.area === migliorPunteggio.area && s.latoCorto < migliorPunteggio.latoCorto)) {
            migliorPunteggio = s;
            migliorSpazio = spazio;
            rotazioneMigliore = false;
            indiceMigliore = i;
          }
        }

        if (pezzo.puoRuotare && puoEntrare(spazio, pezzo.altezza, pezzo.larghezza)) {
          const s = calcolaPunteggio(spazio, pezzo.altezza, pezzo.larghezza);
          if (!migliorPunteggio || s.area < migliorPunteggio.area || (s.area === migliorPunteggio.area && s.latoCorto < migliorPunteggio.latoCorto)) {
            migliorPunteggio = s;
            migliorSpazio = spazio;
            rotazioneMigliore = true;
            indiceMigliore = i;
          }
        }
      }

      if (!migliorSpazio) {
        posizionati.push({...pezzo, posizionato: false});
        continue;
      }

      const larghezzaT = rotazioneMigliore ? pezzo.altezza : pezzo.larghezza;
      const altezzaT = rotazioneMigliore ? pezzo.larghezza : pezzo.altezza;

      posizionati.push({
        ...pezzo,
        x: migliorSpazio.x,
        y: migliorSpazio.y,
        larghezzaTaglio: larghezzaT,
        altezzaTaglio: altezzaT,
        ruotato: rotazioneMigliore,
        posizionato: true
      });

      const r = migliorSpazio;
      const wDestra = r.w - larghezzaT - spessoreLama;
      const hSopra = r.h - altezzaT - spessoreLama;

      // SPLIT
      if (taglioVerticale) {
        if (wDestra > 0) spaziLiberi.push({x: r.x + larghezzaT + spessoreLama, y: r.y, w: wDestra, h: r.h});
        if (hSopra > 0) spaziLiberi.push({x: r.x, y: r.y + altezzaT + spessoreLama, w: larghezzaT, h: hSopra});
      } else {
        if (wDestra > 0) spaziLiberi.push({x: r.x + larghezzaT + spessoreLama, y: r.y, w: wDestra, h: altezzaT});
        if (hSopra > 0) spaziLiberi.push({x: r.x, y: r.y + altezzaT + spessoreLama, w: r.w, h: hSopra});
      }

      spaziLiberi.splice(indiceMigliore, 1);
    }

    // ALLA FINE DEL CALCOLO: restituiamo sia i pezzi che lo spazio avanzato
    return {posizionati, scarti: spaziLiberi};
  }
}
