import {Component, inject, signal} from '@angular/core';
import {Router, RouterLink, RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  router = inject(Router);
  protected readonly title = signal('ToolFalegnameria');

  // Aggiungi questo nuovo metodo
  logout() {
    // Qui in futuro potrai aggiungere la logica per rimuovere token (es. localStorage.removeItem('token'))
    console.log('Logout effettuato');

    // Riporta l'utente alla schermata di login
    this.router.navigate(['/login']);
  }
}
