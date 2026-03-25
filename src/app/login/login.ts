import {ChangeDetectorRef, Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {Auth} from '../auth/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  // ReactiveFormsModule abilita i form, RouterLink permette di usare routerLink nell'HTML
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  // Variabile per mostrare a schermo l'errore se il login fallisce
  errore = '';

  // FormBuilder: strumento di Angular per configurare il form in modo rapido
  private fb = inject(FormBuilder);
  // Creazione del form e delle sue regole di validazione
  loginForm = this.fb.group({
    // L'email parte vuota (''), è obbligatoria e deve avere il formato @...
    email: ['', [Validators.required, Validators.email]],
    // La password parte vuota (''), è obbligatoria e deve avere almeno 6 caratteri
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  // il ChangeDetectorRef serve per rilevare le modifiche e aggiornare l'interfaccia'
  private cdr = inject(ChangeDetectorRef);
  // Router: serve per cambiare pagina via codice
  private router = inject(Router);

  // Inietta il nostro servizio per comunicare col backend e gestire la sessione
  private authService = inject(Auth);

  /**
   * Metodo richiamato quando l'utente preme il bottone "Login"
   */
  onSubmit() {
    // Procede con la chiamata solo se l'utente ha rispettato le regole (email valida, pw > 6)
    if (this.loginForm.valid) {

      // Invia i dati del form al backend
      // subscribe serve per rimanere in ascolto della risposta (next) o per gestire gli errori (error)
      this.authService.login(this.loginForm.value).subscribe({

        // Se il server accetta le credenziali (tutto ok)
        // ora dovremmo avere un obserbable che contiene l'utente loggato
        next: (utente: any) => {
          // Salva l'utente nel LocalStorage (così non deve rifare il login se aggiorna la pagina)
          this.authService.setUtenteLoggato(utente);

          //Controllo del ruolo per il reindirizzamento
          if (utente.ruolo === 'CLIENTE') {
            // Se è un cliente, lo mandiamo alla sua dashboard (che creeremo tra poco)
            this.router.navigate(['/dashboard-cliente']);
          } else {
            // Se è un falegname (o non ha ruolo specifico, per retrocompatibilità)
            this.router.navigate(['/home']);
          }
        },

        // Se il server rifiuta le credenziali (errore)
        error: () => {
          this.errore = 'Email o password errati.';

          // In questo modo forziamo il rilevamento delle modifiche per aggiornare l'interfaccia's
          this.cdr.detectChanges();
        }
      });
    }
  }
}
