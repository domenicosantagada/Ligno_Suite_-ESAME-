# LignoSuite - Frontend (Client Angular)

Questo repository contiene il codice sorgente del frontend per l'applicazione **LignoSuite**, un software gestionale per falegnamerie sviluppato in occasione dell'esame di Web Applications.

**STUDENTE:** Santagada Domenico  
**MATRICOLA:** 213544

L'applicazione (Single Page Application) permette agli utenti di registrarsi scegliendo il proprio ruolo (Falegname o Cliente), autenticarsi, gestire la propria rubrica clienti, monitorare le statistiche e compilare preventivi completi con calcolo automatico. L'interfaccia comunica tramite chiamate API RESTful con il backend Spring Boot.

## Tecnologie e Librerie Utilizzate

* **Framework:** Angular 21 (Architettura a Standalone Components)
* **Gestione Stato:** Angular Signals (per una reattività dell'interfaccia moderna e ottimizzata)
* **Routing:** Angular Router con Route Guards (Protezione delle rotte private in base all'autenticazione)
* **Stile & UI:** Bootstrap 5 e Bootstrap Icons
* **Integrazioni Esterne (Librerie di terze parti):**
  * **Chart.js:** Per la renderizzazione grafica delle statistiche nella Dashboard.
  * **html2pdf.js:** Per la generazione e l'esportazione lato client dei preventivi in formato PDF.
  * **SweetAlert2:** Per la gestione avanzata, accessibile e responsiva dei popup di sistema e modali di conferma.
  * **Google Gemini AI (via Backend):** Interfaccia per la generazione assistita dall'Intelligenza Artificiale delle descrizioni delle voci di preventivo.

---

## Prerequisiti

Per eseguire il progetto sul proprio ambiente locale è necessario aver installato:

* **Node.js** (versione 20.x o superiore raccomandata per Angular 21).
* **NPM** (incluso in Node.js).
* **Angular CLI** (installabile globalmente tramite `npm install -g @angular/cli`).

---

## Configurazione e Avvio

**ATTENZIONE:** Prima di avviare il client Angular, assicurarsi che il **Backend (Spring Boot)** sia in esecuzione e in ascolto sulla porta `8080`. Il frontend è configurato per puntare di default a `http://localhost:8080/api/`.

1. Clonare il repository o estrarre i file in una directory locale.
2. Aprire il terminale nella root del progetto (dove si trova il file `package.json`).
3. Installare le dipendenze scaricando le librerie necessarie:
   ```bash
   npm install
