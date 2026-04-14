import {Component, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Auth} from '../auth/auth';
import {Router} from '@angular/router';
import {PreventiviService} from '../preventivi/preventivi.service';
import {InvoiceData} from '../preventivi/preventivi.model';

@Component({
  selector: 'app-dashboard-cliente',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-cliente.html',
  styleUrls: ['./dashboard-cliente.css']
})
export class DashboardCliente implements OnInit {

  // ======= Signals =======
  nomeCliente = signal<string>('');                     // nome del cliente loggato
  dataOggi = signal<string>('');                        // data odierna in formato leggibile
  utente = signal<any>(null);                            // dati dell'utente loggato
  preventiviRicevuti = signal<InvoiceData[]>([]);           // lista dei preventivi ricevuti

  // ======= Servizi iniettati =======
  private authService = inject(Auth);
  private router = inject(Router);
  private preventiviService = inject(PreventiviService);

  // ======= Ciclo di vita del componente =======
  ngOnInit() {
    this.inizializzaUtente();
    this.impostaDataOggi();
  }

  // ======= Metodi pubblici =======
  /**
   * Apre il preventivo selezionato in modalità preview.
   */
  /**
   * Apre il preventivo selezionato.
   */
  apriPreventivo(preventivoBase: InvoiceData) {
    if (!preventivoBase.id) return;

    // 1. Chiamiamo il backend per avere il DTO completo con gli items
    this.preventiviService.getPreventivoDettaglioCliente(preventivoBase.id).subscribe({
      next: (preventivoCompleto) => {

        // 2. Salviamo il preventivo completo in memoria (nel servizio) per poterlo mostrare nella pagina di preview
        this.preventiviService.impostaPreventivoInMemoria(preventivoCompleto);

        // 3. Navighiamo all'anteprima
        this.router.navigate(['/preventivi'], {queryParams: {preview: 'true'}});
      },
      error: (err) => {
        console.error('Errore durante il caricamento del dettaglio preventivo', err);
        alert('Impossibile caricare i dettagli del preventivo.');
      }
    });
  }

  // ======= Metodi privati =======
  /**
   * Recupera l'utente loggato e carica i preventivi se è un cliente.
   * Se l'utente non è un cliente, lo reindirizza alla home.
   */
  private inizializzaUtente() {
    const utenteLoggato = this.authService.getUtenteLoggato();

    if (!utenteLoggato || utenteLoggato.ruolo !== 'CLIENTE') {
      this.router.navigate(['/home']);
      return;
    }

    this.utente.set(utenteLoggato);
    this.nomeCliente.set(utenteLoggato.nome);

    // Abbiamo il ruolo giusto, chiamiamo la funzione senza passare l'email!
    this.caricaPreventivi();
  }

  /**
   * Recupera i preventivi dal backend. Il backend userà il token JWT.
   */
  private caricaPreventivi() {
    this.preventiviService.getPreventiviPerCliente().subscribe({
      next: dati => this.preventiviRicevuti.set(dati),
      error: err => console.error('Errore nel recupero preventivi cliente', err)
    });
  }

  /**
   * Imposta la signal `dataOggi` con la data odierna formattata in italiano.
   */
  private impostaDataOggi() {
    const opzioni: Intl.DateTimeFormatOptions = {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'};
    const data = new Date().toLocaleDateString('it-IT', opzioni);
    this.dataOggi.set(data.charAt(0).toUpperCase() + data.slice(1));
  }
}
