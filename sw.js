// TIM Bollette - funzionamento offline. Cambiare VERSIONE a ogni aggiornamento (e anche version.json).
// v2.9: pagina, js/ e file di configurazione arrivano SEMPRE prima dalla rete (la copia salvata serve solo offline),
// così dopo un aggiornamento non restano mai file vecchi mescolati a quelli nuovi.
const VERSIONE = 'tim-bollette-v3.1';
const BASE = ['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','lib/pdfjs/pdf.min.js','lib/pdfjs/pdf.worker.min.js','lib/qrcode.js','js/extra.js','js/cloud.js','js/blocco.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => Promise.all(BASE.map(u => fetch(new Request(u, {cache:'reload'})).then(r => r.ok ? c.put(u, r) : null).catch(() => null)))));
  self.skipWaiting();
});
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIONE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  const u = new URL(e.request.url);
  if (u.pathname.endsWith('version.json')) return;                       // sempre dalla rete
  const statico = /\/(lib|icons)\//.test(u.pathname);                    // librerie e icone: non cambiano
  if (!statico) { // prima la rete (senza cache del browser), poi la copia salvata se offline
    e.respondWith(fetch(e.request, {cache:'no-cache'}).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSIONE).then(x => x.put(e.request, c)); } return r; })
      .catch(() => caches.match(e.request, {ignoreSearch:true}).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined))));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(VERSIONE).then(x => x.put(e.request, c)); } return res; })));
  }
});
