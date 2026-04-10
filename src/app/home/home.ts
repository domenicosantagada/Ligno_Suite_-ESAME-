import {AfterViewInit, Component, ElementRef, inject, OnInit, signal, ViewChild} from '@angular/core';
import {Auth} from '../auth/auth';
import {PreventiviService} from '../preventivi/preventivi.service';
import {RubricaService} from '../rubrica/rubrica.service';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home implements OnInit, AfterViewInit {

  // ======= ViewChild per il canvas del grafico =======
  @ViewChild('preventiviChart') chartRef!: ElementRef;

  // ======= Signals per dati visibili nel template =======
  nomeTitolare = signal<string>('');
  dataOggi = signal<string>('');
  totalePreventivi = signal<number>(0);
  preventiviNelPeriodo = signal<number>(0);
  ultimoPreventivoText = signal<string>('Nessun preventivo');
  ultimoPreventivoCliente = signal<string>('');
  totaleClienti = signal<number>(0);

  // ======= Variabili di stato interne =======
  public chart: Chart | null = null;
  menuAperto = signal<boolean>(false);
  periodoSelezionato = signal<string>('6 Mesi');
  preventivi: any[] = []; // tutti i preventivi caricati dal backend

  // ======= Servizi iniettati =======
  private authService = inject(Auth);
  private preventiviService = inject(PreventiviService);
  private rubricaService = inject(RubricaService);

  // ======= Ciclo di vita del componente =======
  ngOnInit() {
    this.impostaDataOggi();
    this.caricaDatiUtente();
  }

  // ngAfterViewInit serve per assicurarsi che il canvas sia presente nel DOM prima di inizializzare Chart.js
  // il canvas è quell'elemento che
  ngAfterViewInit(): void {
    // Assicura che il canvas sia pronto prima di creare il grafico
    requestAnimationFrame(() => {
      this.creaGraficoBase();
      this.caricaStatistiche();
    });
  }

  // ======= Metodi pubblici =======
  /**
   * Cambia il periodo del grafico e aggiorna i dati e il totale preventivi
   * @param periodo stringa selezionata ('1 Anno', '6 Mesi', '30 Giorni', ecc.)
   */
  cambiaPeriodo(periodo: string) {
    this.periodoSelezionato.set(periodo);
    if (!this.chart) return;

    const {labels, dati} = this.calcolaDatiPeriodo(periodo);

    // Aggiorna il grafico
    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = dati;
    this.chart.update();

    // Aggiorna il totale preventivi nel periodo
    this.preventiviNelPeriodo.set(dati.reduce((sum, val) => sum + val, 0));
  }

  // ======= Metodi privati =======

  /**
   * Crea il grafico vuoto iniziale con Chart.js
   */
  private creaGraficoBase() {
    if (!this.chartRef) return;
    const ctx = this.chartRef.nativeElement;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Preventivi Creati',
          data: [],
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13, 110, 253, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#0d6efd',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {legend: {display: false}, tooltip: {intersect: false}},
        scales: {y: {beginAtZero: true, ticks: {stepSize: 1}}}
      }
    });
  }

  /**
   * Calcola labels e dati per il grafico in base al periodo selezionato
   */
  private calcolaDatiPeriodo(periodo: string): { labels: string[], dati: number[] } {
    const labels: string[] = [];
    const dati: number[] = [];
    const oggi = new Date();
    oggi.setHours(23, 59, 59, 999);

    if (['1 Anno', '6 Mesi', '4 Mesi'].includes(periodo)) {
      const numMesi = periodo === '1 Anno' ? 12 : periodo === '6 Mesi' ? 6 : 4;
      const mesiNomi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

      for (let i = numMesi - 1; i >= 0; i--) {
        const targetDate = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
        labels.push(mesiNomi[targetDate.getMonth()]);
        dati.push(0);
      }

      this.preventivi.forEach(p => {
        const d = this.parseDate(p.date);
        const diffMesi = (oggi.getFullYear() - d.getFullYear()) * 12 + (oggi.getMonth() - d.getMonth());
        if (diffMesi >= 0 && diffMesi < numMesi) dati[(numMesi - 1) - diffMesi]++;
      });

    } else if (periodo === '2 Mesi') {
      for (let i = 7; i >= 0; i--) {
        labels.push(i === 0 ? 'Questa sett.' : `- ${i} sett.`);
        dati.push(0);
      }
      this.preventivi.forEach(p => {
        const d = this.parseDate(p.date);
        const diffGiorni = Math.floor((oggi.getTime() - d.getTime()) / (1000 * 3600 * 24));
        if (diffGiorni >= 0 && diffGiorni < 56) dati[7 - Math.floor(diffGiorni / 7)]++;
      });

    } else if (periodo === '30 Giorni') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(oggi.getTime() - i * 24 * 3600 * 1000);
        labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
        dati.push(0);
      }
      this.preventivi.forEach(p => {
        const d = this.parseDate(p.date);
        const diffGiorni = Math.floor((oggi.getTime() - d.getTime()) / (1000 * 3600 * 24));
        if (diffGiorni >= 0 && diffGiorni <= 29) dati[29 - diffGiorni]++;
      });
    }

    return {labels, dati};
  }

  /**
   * Imposta la data odierna nella signal dataOggi
   */
  private impostaDataOggi() {
    const opzioni: Intl.DateTimeFormatOptions = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'};
    const data = new Date().toLocaleDateString('it-IT', opzioni);
    this.dataOggi.set(data.charAt(0).toUpperCase() + data.slice(1));
  }

  /**
   * Carica dati dell'utente loggato
   */
  private caricaDatiUtente() {
    const utente = this.authService.getUtenteLoggato();
    if (utente) {
      this.nomeTitolare.set(utente.nomeTitolare || utente.nome || utente.nomeAzienda || 'Artigiano');
    }
  }

  /**
   * Carica tutti i preventivi e clienti dal backend
   * Aggiorna le signals e il grafico
   */
  private caricaStatistiche() {
    // Carica preventivi
    this.preventiviService.getTuttiIPreventivi().subscribe({
      next: (preventivi) => {
        this.preventivi = preventivi || [];

        if (this.preventivi.length > 0) {
          this.totalePreventivi.set(this.preventivi.length);

          // Ordina i preventivi per data decrescente
          const ordinati = [...this.preventivi].sort(
            (a, b) => this.parseDate(b.date).getTime() - this.parseDate(a.date).getTime()
          );

          const ultimo = ordinati[0];
          this.ultimoPreventivoText.set(`N° ${ultimo.invoiceNumber} del ${this.parseDate(ultimo.date).toLocaleDateString('it-IT')}`);
          this.ultimoPreventivoCliente.set(ultimo.toName || 'Cliente non specificato');
        } else {
          this.totalePreventivi.set(0);
          this.preventiviNelPeriodo.set(0);
        }

        // Aggiorna il grafico per il periodo selezionato
        this.cambiaPeriodo(this.periodoSelezionato());
      },
      error: err => console.error('Errore nel caricamento dei preventivi', err)
    });

    // Carica clienti
    this.rubricaService.getClientiDalDb().subscribe({
      next: (clienti: any[]) => this.totaleClienti.set(clienti ? clienti.length : 0),
      error: err => console.error('Errore nel caricamento dei clienti', err)
    });
  }

  /**
   * Converte una stringa in oggetto Date, gestendo vari formati
   */
  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date(0);
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) return new Date(parsed);

    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) return new Date(+parts[2], +parts[1] - 1, +parts[0]);
    return new Date(0);
  }

}
