import {Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {Auth} from '../auth/auth'; // Aggiungi RouterLink

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink], // Aggiungi RouterLink
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  errore = '';
  private fb = inject(FormBuilder);
  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });
  private router = inject(Router);
  private authService = inject(Auth); // Inietta il servizio

  onSubmit() {
    if (this.loginForm.valid) {
      this.authService.login(this.loginForm.value).subscribe({
        next: (utente: any) => {
          // SALVA L'UTENTE NELLA SESSIONE!
          this.authService.setUtenteLoggato(utente);

          this.router.navigate(['/home']);
        },
        error: () => {
          this.errore = 'Email o password errati.';
        }
      });
    }
  }
}
