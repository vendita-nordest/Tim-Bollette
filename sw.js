// TIM Bollette - funzionamento offline. Cambiare VERSIONE a ogni aggiornamento (e anche version.json).
const VERSIONE = 'tim-bollette-v2.1';
const BASE = ['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','lib/pdfjs/pdf.min.js','lib/pdfjs/pdf.worker.min.js','lib/qrcode.js','js/extra.js','js/cloud.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(BASE))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIONE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  const u = new URL(e.request.url);
  if (u.pathname.endsWith('version.json')) return;                       // sempre dalla rete
  const rete = e.request.mode === 'navigate' || /index\.html$|firebase-config\.js$/.test(u.pathname);
  if (rete) { // prima la rete, così gli aggiornamenti arrivano subito
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSIONE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(VERSIONE).then(x => x.put(e.request, c)); } return res; })));
  }
});
