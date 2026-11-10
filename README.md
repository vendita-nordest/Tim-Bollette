# TIM Bollette v1.2

Web app per leggere le bollette luce e gas dei clienti e confrontarle con le offerte TIM Energia.
Funziona su Android, Windows e Mac. La lettura (PDF e foto) avviene sul dispositivo e nulla viene salvato in internet.

## Pubblicazione su GitHub Pages
1. Su github.com crea un nuovo repository (es. `Tim-Bollette`).
2. "Add file" → "Upload files": trascina **tutto il contenuto** di questa cartella (index.html, sw.js, manifest.webmanifest, cartelle `icons` e `lib`) → "Commit changes".
3. Settings → Pages → Branch `main`, cartella `/ (root)` → Save.
4. Dopo 1-2 minuti l'app è su `https://<utente>.github.io/Tim-Bollette/`.
5. Installazione: su Android (Chrome) menu ⋮ → "Aggiungi a schermata Home"; su Mac/Windows (Chrome/Edge) icona "Installa" nella barra degli indirizzi.

## Aggiornamenti
Quando cambi i file, nel file `sw.js` aumenta la VERSIONE (es. `tim-bollette-v1.1`).
I prezzi delle offerte si cambiano dall'app, nella pagina **Listino** (esportabile e importabile tra dispositivi).
