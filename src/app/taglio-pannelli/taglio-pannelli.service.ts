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

    // 3. Testiamo le euristiche (Rimosso il loop verticale/orizzontale perché ora è dinamico)
    for (const strategia of strategieOrdinamento) {

      const pezziCorrenti = [...espansi].sort(strategia);
      // Chiamata al nuovo motore Multi-Pannello
      const risultato = this.eseguiSingolaOttimizzazione(larghezzaPannello, altezzaPannello, spessoreLama, margine, pezziCorrenti);

      if (!migliorRisultato ||
        risultato.pannelli.length < migliorRisultato.pannelli.length ||
        (risultato.pannelli.length === migliorRisultato.pannelli.length && risultato.efficienza > migliorRisultato.efficienza)) {
        migliorRisultato = risultato;
      }
    }

    return migliorRisultato!;
  }

  // --- MOTORE GLOBALE: MULTI-PANNELLO + SPLIT DINAMICO ---
  private eseguiSingolaOttimizzazione(larghezzaPannello: number, altezzaPannello: number, spessoreLama: number, margine: number, listaPezzi: Pezzo[]): RisultatoOttimizzazione {

    // Invece di un solo pannello, gestiamo un array di "Pannelli sul tavolo"
    const pannelliAperti: {
      pannelloLarghezza: number,
      pannelloAltezza: number,
      pezzi: Pezzo[],
      spaziLiberi: Scarto[],
      nonPosizionabili: Pezzo[]
    }[] = [];

    // Funzione "magazziniere": Prende un pannello nuovo e lo mette sul tavolo
    const aggiungiPannello = () => {
      const nuovoPannello = {
        pannelloLarghezza: larghezzaPannello,
        pannelloAltezza: altezzaPannello,
        pezzi: [] as Pezzo[],              // <-- Diciamo a TS che è un array di Pezzi
        spaziLiberi: [{
          x: margine,
          y: margine,
          w: larghezzaPannello - 2 * margine,
          h: altezzaPannello - 2 * margine
        }] as Scarto[],
        nonPosizionabili: [] as Pezzo[]    // <-- Diciamo a TS che è un array di Pezzi
      };
      pannelliAperti.push(nuovoPannello);
      return nuovoPannello;
    };

    const puoEntrare = (rect: any, pw: number, ph: number) => pw <= rect.w && ph <= rect.h;

    // Calcola quanto è "perfetto" l'incastro
    const calcolaPunteggio = (rect: any, pw: number, ph: number) => {
      const area = rect.w * rect.h - pw * ph;
      const latoCorto = Math.min(rect.w - pw, rect.h - ph);
      return {area, latoCorto};
    };

    if (listaPezzi.length > 0) {
      aggiungiPannello(); // Apriamo il primo pannello
    }

    // --- CICLO PRINCIPALE SU TUTTI I PEZZI ---
    for (const pezzo of listaPezzi) {
      let migliorPunteggio: any = null;
      let migliorSpazio: any = null;
      let pannelloMigliore: any = null;
      let rotazioneMigliore = false;
      let indiceSpazioMigliore = -1;

      // 1. ESPLORAZIONE GLOBALE: Cerca l'incastro perfetto su TUTTI i pannelli aperti
      for (const pannello of pannelliAperti) {
        for (let i = 0; i < pannello.spaziLiberi.length; i++) {
          const spazio = pannello.spaziLiberi[i];

          // Prova a inserirlo dritto
          if (puoEntrare(spazio, pezzo.larghezza, pezzo.altezza)) {
            const s = calcolaPunteggio(spazio, pezzo.larghezza, pezzo.altezza);
            if (!migliorPunteggio || s.area < migliorPunteggio.area || (s.area === migliorPunteggio.area && s.latoCorto < migliorPunteggio.latoCorto)) {
              migliorPunteggio = s;
              migliorSpazio = spazio;
              pannelloMigliore = pannello;
              rotazioneMigliore = false;
              indiceSpazioMigliore = i;
            }
          }

          // Prova a inserirlo ruotato (se consentito)
          if (pezzo.puoRuotare && puoEntrare(spazio, pezzo.altezza, pezzo.larghezza)) {
            const s = calcolaPunteggio(spazio, pezzo.altezza, pezzo.larghezza);
            if (!migliorPunteggio || s.area < migliorPunteggio.area || (s.area === migliorPunteggio.area && s.latoCorto < migliorPunteggio.latoCorto)) {
              migliorPunteggio = s;
              migliorSpazio = spazio;
              pannelloMigliore = pannello;
              rotazioneMigliore = true;
              indiceSpazioMigliore = i;
            }
          }
        }
      }

      // 2. SE NON ENTRA DA NESSUNA PARTE, APRIAMO UN NUOVO PANNELLO
      if (!migliorSpazio) {
        const nuovoPannello = aggiungiPannello();
        const spazio = nuovoPannello.spaziLiberi[0];

        const entraDritto = puoEntrare(spazio, pezzo.larghezza, pezzo.altezza);
        const entraRuotato = pezzo.puoRuotare && puoEntrare(spazio, pezzo.altezza, pezzo.larghezza);

        // Controllo di sicurezza
        if (!entraDritto && !entraRuotato) {
          nuovoPannello.nonPosizionabili.push({...pezzo, posizionato: false});
          continue;
        }

        pannelloMigliore = nuovoPannello;
        migliorSpazio = spazio;
        indiceSpazioMigliore = 0;

        // Ottimizza l'inserimento nel nuovo pannello (Shorter Axis Rule)
        if (entraDritto && entraRuotato) {
          const sDritto = calcolaPunteggio(spazio, pezzo.larghezza, pezzo.altezza);
          const sRuotato = calcolaPunteggio(spazio, pezzo.altezza, pezzo.larghezza);
          rotazioneMigliore = (sRuotato.area < sDritto.area || (sRuotato.area === sDritto.area && sRuotato.latoCorto < sDritto.latoCorto));
        } else {
          rotazioneMigliore = !entraDritto;
        }
      }

      // 3. ESECUZIONE DEL TAGLIO
      const larghezzaT = rotazioneMigliore ? pezzo.altezza : pezzo.larghezza;
      const altezzaT = rotazioneMigliore ? pezzo.larghezza : pezzo.altezza;

      // Salviamo il pezzo nel pannello vincitore
      pannelloMigliore.pezzi.push({
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

      // --- SPLIT DINAMICO (L'intelligenza) ---
      if (wDestra >= hSopra) {
        // Taglia verticalmente per massimizzare il blocco di destra
        if (wDestra > 0) pannelloMigliore.spaziLiberi.push({
          x: r.x + larghezzaT + spessoreLama,
          y: r.y,
          w: wDestra,
          h: r.h
        });
        if (hSopra > 0) pannelloMigliore.spaziLiberi.push({
          x: r.x,
          y: r.y + altezzaT + spessoreLama,
          w: larghezzaT,
          h: hSopra
        });
      } else {
        // Taglia orizzontalmente per massimizzare il blocco in basso
        if (wDestra > 0) pannelloMigliore.spaziLiberi.push({
          x: r.x + larghezzaT + spessoreLama,
          y: r.y,
          w: wDestra,
          h: altezzaT
        });
        if (hSopra > 0) pannelloMigliore.spaziLiberi.push({
          x: r.x,
          y: r.y + altezzaT + spessoreLama,
          w: r.w,
          h: hSopra
        });
      }

      // Eliminiamo il vecchio blocco libero
      pannelloMigliore.spaziLiberi.splice(indiceSpazioMigliore, 1);
    }

    // 4. FORMATTAZIONE DEL RISULTATO PER L'INTERFACCIA GRAFICA
    const pannelliRisultato: RisultatoPannello[] = pannelliAperti.map(p => ({
      pannelloLarghezza: p.pannelloLarghezza,
      pannelloAltezza: p.pannelloAltezza,
      pezzi: p.pezzi,
      scarti: p.spaziLiberi.filter(s => s.w > 20 && s.h > 20), // Pulizia scarti microscopici
      nonPosizionabili: p.nonPosizionabili
    })).filter(p => p.pezzi.length > 0 || p.nonPosizionabili.length > 0);

    // Calcolo delle percentuali e riepiloghi globali
    const areaTotalePannelli = pannelliRisultato.length * larghezzaPannello * altezzaPannello;
    let areaUsata = 0;

    pannelliRisultato.forEach(pnl => {
      pnl.pezzi.forEach(p => areaUsata += (p.larghezzaTaglio || 0) * (p.altezzaTaglio || 0));
    });

    const efficienza = areaTotalePannelli > 0 ? (areaUsata / areaTotalePannelli) * 100 : 0;

    return {
      pannelli: pannelliRisultato,
      efficienza,
      areaUsata,
      areaScarto: areaTotalePannelli - areaUsata
    };
  }
}
