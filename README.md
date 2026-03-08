# LignoSuite - Frontend (Client Angular)

Questo repository contiene il codice sorgente del frontend per l'applicazione LignoSuite, un software gestionale per falegnamerie sviluppato in occasione dell'esame di Web Applications.

STUDENTE: **Santagada Domenico**
MATRICOLA: **213544**

L'applicazione (Single Page Application) permette agli utenti di registrarsi, autenticarsi, gestire la propria rubrica clienti e compilare preventivi completi di calcolo automatico di IVA, sconti e totali.
L'interfaccia comunica tramite API RESTful con il backend Spring Boot.

## Tecnologie Utilizzate

* **Framework:** Angular 17+ (con architettura Standalone Components)
* **Linguaggio:** TypeScript, HTML5, CSS3
* **Stile & UI:** Bootstrap 5, SweetAlert2 (per la gestione avanzata dei popup)
* **Routing:** Angular Router con Route Guards (Protezione delle rotte private)
* **Gestione Stato:** Angular Signals (per la reattività dell'interfaccia)
* **Esportazione:** html2pdf.js per la generazione di preventivi in PDF.

## Prerequisiti

Per eseguire il progetto sul proprio computer è necessario aver installato:

* **Node.js** (versione 18.x o superiore raccomandata).

* **NPM**

* **Angular CLI**

## Per eseguire il progetto

1. Clonare il repository.
2. Installa le dipendenze: Esegui questo comando per scaricare tutte le librerie necessarie (verrà creata la cartella node_modules): `npm install`.
3. Avvia il server di sviluppo di Angular: `ng serve`.
4. Apri il browser e naviga all'indirizzo `http://localhost:4200` per accedere all'applicazione.
