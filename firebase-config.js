/* TIM Bollette – collegamento a Firebase (accesso venditori, Listino unico, area Amministratore)
   1) Firebase console › progetto tim-area-1 › Impostazioni progetto › Le tue app › app Web (puoi usare la stessa dell'app Energia)
   2) copia l'oggetto "firebaseConfig" e incollalo qui sotto al posto di null
   3) in ADMIN_EMAILS metti l'email (o le email) con cui entra l'amministratore
   Finché FIREBASE_CONFIG è null l'app funziona senza login e senza registro attività. */
window.FIREBASE_CONFIG = null;
/* esempio:
window.FIREBASE_CONFIG = {
  apiKey: "....",
  authDomain: "tim-area-1.firebaseapp.com",
  projectId: "tim-area-1",
  storageBucket: "tim-area-1.appspot.com",
  messagingSenderId: "....",
  appId: "...."
};
*/
window.ADMIN_EMAILS = ['applicazionijcp@gmail.com'];
