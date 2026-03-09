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
  styleUrl: './home.css'
})
export class Home implements OnInit, AfterViewInit {

  @ViewChild('preventiviChart') chartRef!: ElementRef;

  nomeTitolare = signal<string>('');
  dataOggi = signal<string>('');
  totalePreventivi = signal<number>(0);
  ultimoPreventivoText = signal<string>('Nessun preventivo');
  ultimoPreventivoCliente = signal<string>('');
  totaleClienti = signal<number>(0);
  preventiviUltimi30Giorni = signal<number>(0);

  public chart: any;
  menuAperto = signal<boolean>(false);
  periodoSelezionato = signal<string>('6 Mesi');
  tuttiIPreventivi: any[] = [];

  private authService = inject(Auth);
  private preventiviService = inject(PreventiviService);
  private rubricaService = inject(RubricaService);

  ngOnInit() {
    this.impostaDataOggi();
    this.caricaDatiUtente();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.creaGraficoBase();
      this.caricaStatistiche();
    }, 150);
  }

  creaGraficoBase() {
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
        scales: {
          y: {beginAtZero: true, ticks: {stepSize: 1}}
        }
      }
    });
  }

  /**
   * Viene chiamata dal menu a tendina dell'HTML e ricalcola tutti i dati
   */
  cambiaPeriodo(periodo: string) {
    this.periodoSelezionato.set(periodo);

    // Controlliamo solo che il grafico esista. (Abbiamo rimosso il blocco dei preventivi vuoti)
    if (!this.chart) return;

    const labels: string[] = [];
    const dati: number[] = [];
    const oggi = new Date();
    oggi.setHours(23, 59, 59, 999);

    // LOGICA PER MESI (1 Anno, 6 Mesi, 4 Mesi)
    if (periodo === '1 Anno' || periodo === '6 Mesi' || periodo === '4 Mesi') {
      const numMesi = periodo === '1 Anno' ? 12 : (periodo === '6 Mesi' ? 6 : 4);
      const mesiNomi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

      for (let i = numMesi - 1; i >= 0; i--) {
        const targetDate = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
        labels.push(mesiNomi[targetDate.getMonth()]);
        dati.push(0);
      }

      this.tuttiIPreventivi.forEach(p => {
        const d = this.parseDate(p.date);
        const diffMesi = (oggi.getFullYear() - d.getFullYear()) * 12 + (oggi.getMonth() - d.getMonth());
        if (diffMesi >= 0 && diffMesi < numMesi) dati[(numMesi - 1) - diffMesi]++;
      });
    }
    // LOGICA PER SETTIMANE (2 Mesi -> 8 Settimane)
    else if (periodo === '2 Mesi') {
      for (let i = 7; i >= 0; i--) {
        labels.push(i === 0 ? 'Questa sett.' : `- ${i} sett.`);
        dati.push(0);
      }
      this.tuttiIPreventivi.forEach(p => {
        const d = this.parseDate(p.date);
        const diffGiorni = Math.floor((oggi.getTime() - d.getTime()) / (1000 * 3600 * 24));
        if (diffGiorni >= 0 && diffGiorni < 56) dati[7 - Math.floor(diffGiorni / 7)]++;
      });
    }
    // LOGICA GIORNALIERA (30 Giorni)
    else if (periodo === '30 Giorni') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(oggi.getTime() - i * 24 * 3600 * 1000);
        labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
        dati.push(0);
      }
      this.tuttiIPreventivi.forEach(p => {
        const d = this.parseDate(p.date);
        const diffGiorni = Math.floor((oggi.getTime() - d.getTime()) / (1000 * 3600 * 24));
        if (diffGiorni >= 0 && diffGiorni <= 29) dati[29 - diffGiorni]++;
      });
    }

    // Aggiorna visivamente il grafico con i nuovi assi (e nuova animazione!)
    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = dati;
    this.chart.update();
  }

  private impostaDataOggi() {
    const opzioni: Intl.DateTimeFormatOptions = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'};
    let data = new Date().toLocaleDateString('it-IT', opzioni);
    data = data.charAt(0).toUpperCase() + data.slice(1);
    this.dataOggi.set(data);
  }

  private caricaDatiUtente() {
    const utente = this.authService.getUtenteLoggato();
    if (utente) {
      this.nomeTitolare.set(utente.nomeTitolare || utente.nome || utente.nomeAzienda || 'Artigiano');
    }
  }

  private caricaStatistiche() {
    // 1. CARICA PREVENTIVI
    this.preventiviService.getTuttiIPreventivi().subscribe({
      next: (preventivi) => {
        // Salviamo sempre l'array, se è vuoto creiamo un array vuoto
        this.tuttiIPreventivi = preventivi || [];

        if (this.tuttiIPreventivi.length > 0) {
          this.totalePreventivi.set(this.tuttiIPreventivi.length);

          const ordinati = [...this.tuttiIPreventivi].sort((a, b) => this.parseDate(b.date).getTime() - this.parseDate(a.date).getTime());
          const ultimo = ordinati[0];

          this.ultimoPreventivoText.set(`N° ${ultimo.invoiceNumber} del ${this.parseDate(ultimo.date).toLocaleDateString('it-IT')}`);
          this.ultimoPreventivoCliente.set(ultimo.toName || 'Cliente non specificato');

          const trentaGiorniFa = new Date();
          trentaGiorniFa.setDate(trentaGiorniFa.getDate() - 30);
          this.preventiviUltimi30Giorni.set(this.tuttiIPreventivi.filter((p: any) => this.parseDate(p.date) >= trentaGiorniFa).length);

        } else {
          this.totalePreventivi.set(0);
          this.preventiviUltimi30Giorni.set(0);
        }

        // AGGIORNA IL GRAFICO SEMPRE (anche se non ci sono preventivi per disegnare le etichette giuste a 0)
        this.cambiaPeriodo(this.periodoSelezionato());
      },
      error: (err) => console.error('Errore nel caricamento dei preventivi', err)
    });

    // 2. CARICA CLIENTI
    this.rubricaService.getClientiDalDb().subscribe({
      next: (clienti: any[]) => this.totaleClienti.set(clienti ? clienti.length : 0),
      error: (err) => console.error('Errore nel caricamento dei clienti', err)
    });
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date(0);
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return new Date(0);
  }
}
