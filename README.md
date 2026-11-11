# TIM Bollette v2.1

Web app per i negozi: legge le bollette luce e gas dei clienti e le confronta con le offerte TIM Energia.
Funziona su Android, Windows e Mac. La bolletta viene letta sul dispositivo: nessun dato dei clienti va in internet.

## Aggiornare l'app su GitHub (repository Tim-Bollette, account vendita-nordest)
1. "Add file" -> "Upload files": trascina tutto il contenuto di questa cartella (anche le cartelle js, lib, materiali, icons) -> "Commit changes".
2. Dopo 1-2 minuti i telefoni con l'app aperta vedono il banner "E' disponibile la versione..." -> "Aggiorna".
3. Per le versioni future: cambia il numero in version.json e in sw.js (VERSIONE).

## Accesso venditori e area Amministratore (Firebase)
Senza questi passaggi l'app funziona lo stesso, ma senza login e senza registro attivita'.
1. Configurazione: Firebase console -> progetto tim-area-1 -> Impostazioni progetto -> "Le tue app" -> app Web (va bene quella dell'app Energia) -> copia l'oggetto firebaseConfig e incollalo nel file firebase-config.js al posto di null. In ADMIN_EMAILS lascia (o cambia) l'email dell'amministratore.
2. Regole: Firestore Database -> Regole -> AGGIUNGI (senza cancellare quelle di Energia e Business) il contenuto di firestore-regole.txt -> Pubblica.
3. L'accesso email/password deve essere attivo in Authentication (lo e' gia' per l'app Energia).
4. Entra nell'app con l'email amministratore: compare la pagina Admin, da cui crei gli account dei venditori (nome, email, password provvisoria, negozio, insegna).

Cosa viene registrato: solo le azioni (check-up, esito, riepiloghi, preventivi, QR, promemoria, richiami, obiezioni, quiz) con venditore e negozio. Mai nomi, foto, POD o PDR dei clienti.
Il report per negozio si esporta in Excel e si puo' inviare; il report per addetto e' visibile solo all'amministratore.

## Cosa resta sul singolo dispositivo
- Scadenziario richiami: cifrato con la password scelta dal venditore (se la dimentica i dati non si recuperano).
- PIN del Listino (se l'app non e' collegata a Firebase), dati del negozio per i QR, testi di obiezioni e contatti modificati.
