import {Component, HostListener, inject, OnInit, signal} from '@angular/core';
import {Router, RouterLink, RouterOutlet} from '@angular/router';
import {Auth} from './auth/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  router = inject(Router);
  authService = inject(Auth);

  menuGestioneAperto = signal(false);
  protected readonly title = signal('ToolFalegnameria');

  toggleMenuGestione(event: Event) {
    event.stopPropagation();
    this.menuGestioneAperto.update(v => !v);
  }

  @HostListener('document:click')
  chiudiMenuSeClicchiFuori() {
    if (this.menuGestioneAperto()) {
      this.menuGestioneAperto.set(false);
    }
  }

  // IL METODO ORA È VUOTO (NESSUN ACCESSO SEGRETO!)
  ngOnInit() {

  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
