import {Component, inject, signal} from '@angular/core';
import {Router, RouterLink, RouterOutlet} from '@angular/router';
import {Auth} from './auth/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})

export class App {
  router = inject(Router);
  authService = inject(Auth); // Inietta il servizio
  protected readonly title = signal('ToolFalegnameria');

  logout() {
    this.authService.logout(); // Cancella i dati dal localStorage
    this.router.navigate(['/login']);
  }
}
