/* TIM Bollette – funzioni aggiuntive v2.0
   (guida, versione, PIN Listino, CTE, esiti, IVA, grafici, preventivo, richiami, segnalazioni, quiz) */
"use strict";

/* ---------- registro attività (va su Firebase solo se configurato) ---------- */
function logEvento(tipo, dati){ try{ if(window.Cloud && Cloud.attivo) Cloud.evento(tipo, dati||{}); }catch(e){ console.warn(e); } }
function registraCheckup(S, ES){
  if(CHECKUP_REGISTRATO) return; CHECKUP_REGISTRATO = true;
  logEvento('checkup', {
    fornitori: [...new Set(S.F.map(f=>f.d.fornitore||'non letto'))],
    forniture: S.F.map(f=>f.k), esito: ES.k,
    vantaggio1: Math.round(S.tot1), energia: Math.round(S.energia), sconto: SCONTO.mese||0,
    case: CASE.length
  });
}

/* ---------- modale generico ---------- */
function apriModale(html){ $('#mbox').innerHTML = html; $('#modale').classList.add('on'); }
function chiudiModale(){ $('#modale').classList.remove('on'); }
$('#modale').addEventListener('click', e=>{ if(e.target.id==='modale' || e.target.closest('[data-chiudi]')) chiudiModale(); });

/* ---------- guida rapida ---------- */
function apriGuida(){
  if($('#modale').dataset.bloccato==='1') return;
  apriModale(`<h2>Come si usa TIM Bollette</h2>
  <ol style="padding-left:18px;line-height:1.5">
    <li><b>Bolletta</b>: carica il PDF o fotografa la bolletta del cliente. Controlla i campi: verdi = letti, gialli = da completare.</li>
    <li><b>Cliente</b>: fai le domande, soprattutto <b>quanto paga internet e cellulare</b>: è lì che TIM recupera.</li>
    <li><b>Risultato</b>: guarda l'esito (subito / con pacchetto / non ora), la scala della convenienza e le leve “Per il venditore”. Con “Mostra al cliente” nascondi i tuoi margini.</li>
    <li><b>Chiudi</b>: invia il riepilogo su WhatsApp (anche in altre lingue) o il preventivo PDF. Se oggi non passa, aggiungilo ai <b>Richiami</b>.</li>
  </ol>
  <p class="small">Altre pagine: Obiezioni (risposte pronte), Contatti (numeri utili e QR rubrica), QR negozio, Materiali (locandine), Listino (prezzi, protetto da PIN).</p>
  <label class="small"><input type="checkbox" id="guidaNoPiu"> Non mostrare più all'avvio</label>
  <div class="azioni"><button class="btn" data-chiudi id="guidaOk">Ho capito</button></div>`);
  $('#guidaOk').onclick=()=>{ if($('#guidaNoPiu').checked){ try{ localStorage.setItem('guidaVista','1'); }catch(e){} } chiudiModale(); };
}
$('#btnGuida').onclick = apriGuida;

/* ---------- avviso di nuova versione ---------- */
async function controllaVersione(){
  try{
    const r = await fetch('version.json?t='+Date.now(), {cache:'no-store'}); if(!r.ok) return;
    const v = await r.json();
    if(v.versione && v.versione !== VERSIONE){
      $('#bannerVersione').innerHTML = `<div class="banner">🔄 È disponibile la versione ${esc(v.versione)}${v.note?': '+esc(v.note):''}<button class="btn" id="btnAggiorna">Aggiorna</button></div>`;
      $('#btnAggiorna').onclick = async()=>{
        try{ const regs = await navigator.serviceWorker?.getRegistrations?.() || []; for(const g of regs) await g.unregister(); const k = await caches.keys(); for(const c of k) await caches.delete(c); }catch(e){}
        location.reload();
      };
    }
  }catch(e){}
}
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) controllaVersione(); });
setInterval(controllaVersione, 30*60*1000);

/* ---------- PIN del Listino ---------- */
let LISTINO_SBLOCCATO = false;
async function hashPin(pin){ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('timbollette:'+pin)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
function pinSalvato(){ if(window.PIN_CENTRALE) return window.PIN_CENTRALE; try{ return localStorage.getItem('pinListino')||''; }catch(e){ return ''; } }
function listinoModificabile(){ return LISTINO_SBLOCCATO || !pinSalvato() || (window.Cloud && Cloud.isAdmin); }
function renderLock(){
  const area=$('#listinoArea'), lock=$('#listinoLock');
  if(listinoModificabile()){ area.style.display=''; lock.innerHTML = pinSalvato()? '' : '<div class="avviso">Nessun PIN impostato: chiunque usi questo dispositivo può cambiare i prezzi. Imposta un PIN con il tasto “🔑 PIN del Listino”.</div>'; return; }
  area.style.display='none';
  lock.innerHTML = `<div class="lock"><p>🔒 Il Listino è protetto. Inserisci il PIN per modificarlo.</p>
    <input id="pinIn" type="password" inputmode="numeric" style="font-size:20px;padding:8px;width:160px;text-align:center;border:1px solid var(--linea);border-radius:10px">
    <div class="azioni" style="justify-content:center"><button class="btn" id="pinSblocca">Sblocca</button></div><p class="small" id="pinErr"></p>
    <div id="listinoSolaLettura"></div></div>`;
  $('#pinSblocca').onclick = async()=>{ if(await hashPin($('#pinIn').value) === pinSalvato()){ LISTINO_SBLOCCATO=true; renderListino(); renderLock(); } else $('#pinErr').textContent='PIN errato'; };
  $('#listinoSolaLettura').innerHTML = `<p class="small">Prezzi in uso: luce ${fmt(L.luce.prezzo,3)} €/kWh · gas PSV + ${fmt(L.gas.spread,3)} €/Smc · valide fino al ${dataIT(L.luce.scadenza)} · aggiornato il ${dataIT(L.aggiornato)}</p>`;
}
$('#btnPin').onclick = ()=>{
  if(!listinoModificabile()) return;
  apriModale(`<h2>🔑 PIN del Listino</h2><p class="small">Chi non conosce il PIN può vedere i prezzi ma non modificarli.${window.Cloud&&Cloud.isAdmin?' Il PIN vale per tutti i negozi collegati.':''}</p>
   <label class="c">Nuovo PIN (almeno 4 cifre)<input id="pin1" type="password" inputmode="numeric"></label>
   <label class="c" style="margin-top:8px">Ripeti il PIN<input id="pin2" type="password" inputmode="numeric"></label>
   <div class="azioni"><button class="btn" id="pinSalva">Salva PIN</button>${pinSalvato()?'<button class="btn sec" id="pinTogli">Togli PIN</button>':''}<button class="btn sec" data-chiudi>Annulla</button></div><p class="small" id="pinMsg"></p>`);
  $('#pinSalva').onclick = async()=>{ const a=$('#pin1').value, b=$('#pin2').value; if(a.length<4){ $('#pinMsg').textContent='Il PIN deve avere almeno 4 cifre'; return; } if(a!==b){ $('#pinMsg').textContent='I due PIN non coincidono'; return; }
    const h=await hashPin(a); try{ localStorage.setItem('pinListino',h); }catch(e){} if(window.Cloud&&Cloud.isAdmin) Cloud.salvaPin(h); window.PIN_CENTRALE = window.Cloud&&Cloud.isAdmin ? h : window.PIN_CENTRALE; LISTINO_SBLOCCATO=true; chiudiModale(); renderLock(); };
  if($('#pinTogli')) $('#pinTogli').onclick = ()=>{ try{ localStorage.removeItem('pinListino'); }catch(e){} if(window.Cloud&&Cloud.isAdmin){ Cloud.salvaPin(''); window.PIN_CENTRALE=''; } chiudiModale(); renderLock(); };
};
// protezione dei pulsanti di modifica del Listino
(function(){
  const salva=$('#btnSalvaListino').onclick, reset=$('#btnReset').onclick;
  $('#btnSalvaListino').onclick = ()=>{ if(!listinoModificabile()) return; salva(); try{ localStorage.setItem('quizListino', L.aggiornato); }catch(e){} if(window.Cloud && Cloud.isAdmin) Cloud.salvaListino(L); };
  $('#btnReset').onclick = ()=>{ if(!listinoModificabile()) return; reset(); };
  const imp=$('#btnImporta').onclick; $('#btnImporta').onclick = ()=>{ if(listinoModificabile()) imp(); };
})();

/* ---------- Listino dalla CTE TIM (PDF) ---------- */
$('#btnCTE').onclick = ()=>{ if(listinoModificabile()) $('#cteIn').click(); };
$('#cteIn').onchange = async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  $('#cteRisultato').innerHTML='<p class="small">Lettura della CTE…</p>';
  try{
    const pdf = await pdfjsLib.getDocument({data: await f.arrayBuffer()}).promise; let t='';
    for(let p=1;p<=pdf.numPages;p++){ const pg=await pdf.getPage(p); const tc=await pg.getTextContent(); t+=tc.items.map(i=>i.str).join(' ')+'\n'; }
    mostraProposteCTE(leggiCTE(t));
  }catch(err){ $('#cteRisultato').innerHTML='<div class="avviso rosso">Non riesco a leggere il PDF: '+esc(err.message)+'</div>'; }
};
function leggiCTE(raw){
  const t = raw.replace(/\s+/g,' ');
  const nKwh=(t.match(/kwh/gi)||[]).length, nSmc=(t.match(/smc/gi)||[]).length;
  const k = nSmc>nKwh ? 'gas' : 'luce'; const P={};
  const num = s=>parseIT(s);
  const val = t.match(/dal\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+al\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if(val){ const d=parseData(val[2]); if(d) P.scadenza = dataInput(d); }
  const comm = t.match(/(\d{2,3}(?:,\d{1,2})?)\s*€\s*\/\s*(?:PoD|POD|PdR|PDR|punto(?:\s+di\s+\w+)?)\s*\/\s*anno/i) || t.match(/commercializzazion\w*[^.]{0,80}?(\d{2,3}(?:,\d{1,2})?)\s*€[^.]{0,20}?anno/i);
  if(comm) P.comm = num(comm[1]);
  const bon = t.match(/(\d{1,2},\d{2})\s*€[^.]{0,40}?(?:per ogni|al|ogni|\/)\s*mese/i);
  if(bon && /promo|bonus|sconto/i.test(t)) P.bonusMese = num(bon[1]);
  const bm = t.match(/primi\s+(\d{1,2})\s+mesi/i); if(bm && P.bonusMese) P.bonusMesi = +bm[1];
  const mb = t.match(/(?:fiss\w*|bloccat\w*|invariabil\w*)[^.]{0,90}?(\d{1,2})\s*mesi/i); if(mb) P.mesiBlocco = +mb[1];
  if(k==='luce'){
    const pr = t.match(/(0,\d{3,4})\s*€\s*\/\s*kWh/i); if(pr) P.prezzo = num(pr[1]);
  } else {
    const sp = t.match(/PSV[^.]{0,80}?\+\s*(?:uno\s+spread\s+(?:di\s+)?)?(0,\d{2,4})\s*€?\s*\/?\s*Smc/i) || t.match(/spread[^.]{0,50}?(0,\d{2,4})\s*€\s*\/\s*Smc/i);
    if(sp) P.spread = num(sp[1]);
  }
  const cod = t.match(/codice\s+offerta\s*:?\s*([0-9A-Z]{15,})/i);
  return {k, P, codice: cod?cod[1]:''};
}
function mostraProposteCTE(r){
  const nomi = {prezzo:'Prezzo energia €/kWh', spread:'Spread su PSV €/Smc', comm:'Commercializzazione €/anno', bonusMese:'Bonus Special €/mese', bonusMesi:'Bonus per (mesi)', mesiBlocco:'Prezzo bloccato (mesi)', scadenza:'Valida fino al'};
  const righe = Object.entries(r.P).filter(([f,v])=>v!==undefined && !(typeof v==='number'&&!isFinite(v)));
  if(!righe.length){ $('#cteRisultato').innerHTML='<div class="avviso">Non ho trovato valori riconoscibili in questa CTE: aggiorna il Listino a mano.</div>'; return; }
  let h=`<div class="card" style="border-color:#b8cbef"><h3 style="margin-top:0">CTE ${r.k==='luce'?'💡 luce':'🔥 gas'}${r.codice?' · '+esc(r.codice):''}</h3><table class="adm"><tr><th></th><th>Voce</th><th>Ora</th><th>Nella CTE</th></tr>`;
  for(const [f,v] of righe){ const att=L[r.k][f]; const diverso = String(att)!==String(v);
    h+=`<tr><td><input type="checkbox" data-cte="${f}" ${diverso?'checked':''}></td><td>${nomi[f]||f}</td><td>${f==='scadenza'?dataIT(att):esc(String(att).replace('.',','))}</td><td><b>${f==='scadenza'?dataIT(v):esc(String(v).replace('.',','))}</b></td></tr>`; }
  h+=`</table><div class="azioni"><button class="btn picc" id="cteApplica">Applica e salva</button><button class="btn sec picc" id="cteAnnulla">Annulla</button></div><p class="small">Controlla sempre i valori con la CTE prima di salvare.</p></div>`;
  $('#cteRisultato').innerHTML=h;
  $('#cteAnnulla').onclick=()=>$('#cteRisultato').innerHTML='';
  $('#cteApplica').onclick=()=>{ document.querySelectorAll('[data-cte]').forEach(c=>{ if(c.checked) L[r.k][c.dataset.cte]=r.P[c.dataset.cte]; }); renderListino(); $('#btnSalvaListino').click(); $('#cteRisultato').innerHTML='<div class="avviso blu">✅ Listino aggiornato dalla CTE.</div>'; };
}

/* ---------- PUN / PSV letti in bolletta ---------- */
function leggiIndici(testo, d){
  const perdF = 1 + (L.luce.perdite||0)/100;
  if(d.luce.presente){
    const m = testo.match(/(?:\bPUN\b|\bMPE\b|prezzo unico nazionale)[^\n]{0,70}?(0[,.]\d{3,6})\s*€?\s*\/\s*kWh/i);
    if(m){ let v=parseIT(m[1]); const conPerdite=/maggiorat\w*\s+delle\s+perdite/i.test(testo); if(conPerdite) v=v/perdF;
      const mese=(m[0].match(/\d{2}\/(\d{2})\/(\d{4})/)||[]); if(v>0.03&&v<0.5) d.luce.indice={nome:/MPE/i.test(m[0])?'MPE (PUN)':'PUN', valore:v, mese:mese[1]?mese[1]+'/'+mese[2]:'', conPerdite}; }
  }
  if(d.gas.presente){
    const m = testo.match(/(?:\bPSV\b|\bMPG\b)[^\n]{0,70}?(0[,.]\d{3,6})\s*€?\s*\/\s*Smc/i);
    if(m){ const v=parseIT(m[1]); const mese=(m[0].match(/\d{2}\/(\d{2})\/(\d{4})/)||[]); if(v>0.15&&v<2) d.gas.indice={nome:/MPG/i.test(m[0])?'MPG (PSV)':'PSV', valore:v, mese:mese[1]?mese[1]+'/'+mese[2]:''}; }
  }
}

/* ---------- grafici dei consumi e della potenza (dalle posizioni del testo nel PDF) ---------- */
const MESI3=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
function leggiGrafici(items, d){
  const perPag={}; for(const it of items){ (perPag[it.p]=perPag[it.p]||[]).push(it); }
  for(const pg of Object.values(perPag)){
    const mesi=[];
    for(let i=0;i<pg.length;i++){
      const s=pg[i].s; let m=s.match(/^(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*\.?\s*'?(\d{2})$/i);
      if(m){ mesi.push({m:m[1].toLowerCase()+' '+m[2], x:pg[i].x+(pg[i].w||0)/2, y:pg[i].y}); continue; }
      m=s.match(/^(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*\.?$/i);
      if(m){ const n=pg.find(o=>o!==pg[i] && Math.abs(o.y-pg[i].y)<2 && o.x>pg[i].x && o.x-pg[i].x<40 && /^'?\d{2}$/.test(o.s)); if(n) mesi.push({m:m[1].toLowerCase()+' '+n.s.replace("'",''), x:(pg[i].x+n.x+(n.w||0))/2, y:pg[i].y}); }
    }
    const righe={}; for(const m of mesi){ const k=Math.round(m.y/3); (righe[k]=righe[k]||[]).push(m); }
    for(const r of Object.values(righe)){
      if(r.length<6) continue; r.sort((a,b)=>a.x-b.x);
      const y0=r[0].y; const passi=r.slice(1).map((m,i)=>m.x-r[i].x).sort((a,b)=>a-b); const passo=passi[Math.floor(passi.length/2)]||20;
      // titolo del grafico: il testo più vicino sopra la riga dei mesi che parla di kWh, Smc o potenza
      const titoli=pg.filter(o=>o.y>y0+5 && o.y<y0+420 && /kwh|smc|potenza|\bkw\b/i.test(o.s)).sort((a,b)=>a.y-b.y);
      const tit=titoli[0]; if(!tit) continue;
      const tipo=/potenza|\(in kw\)|\bkw\)/i.test(tit.s)?'potenza':/smc/i.test(tit.s)?'gas':'luce';
      const numeri=pg.filter(o=>o.y>y0+2 && o.y<tit.y-2 && /^\d+(?:[.,]\d+)?$/.test(o.s) && (o.x+(o.w||0)/2) > r[0].x-passo*0.55);
      const serie=[];
      for(const m of r){ const c=numeri.filter(n=>Math.abs((n.x+(n.w||0)/2)-m.x)<=passo*0.5).sort((a,b)=>b.y-a.y)[0]; if(c) serie.push({m:m.m, v:parseFloat(c.s.replace(',','.'))}); }
      if(serie.length<6) continue;
      if(tipo==='potenza'){ if(d.luce.presente) d.luce.picchi=serie; }
      else if(d[tipo].presente) d[tipo].storico=serie;
    }
  }
}
function graficoStorico(d, U){
  if(!Array.isArray(d.storico) || d.storico.length<6) return '';
  const s=d.storico, max=Math.max(...s.map(x=>x.v))||1, W=360, H=120, bw=W/s.length;
  let bars=''; s.forEach((x,i)=>{ const h=Math.round((x.v/max)*(H-34)); bars+=`<rect x="${(i*bw+2).toFixed(1)}" y="${H-18-h}" width="${(bw-4).toFixed(1)}" height="${h}" rx="2" fill="${i>=s.length-12?'#0033A1':'#9fb3dc'}"/>`+(i%2===s.length%2?'':`<text x="${(i*bw+bw/2).toFixed(1)}" y="${H-5}" font-size="8" text-anchor="middle" fill="#5b6475">${esc(x.m.split(' ')[0])}</text>`); });
  const ult=s.slice(-12).reduce((a,x)=>a+x.v,0);
  return `<details class="small" style="margin-top:6px"><summary>📊 Consumi mese per mese (dalla bolletta)</summary><svg class="grafico" viewBox="0 0 ${W} ${H}">${bars}</svg><div>Ultimi ${Math.min(12,s.length)} mesi: <b>${fmt(ult,0)} ${U}</b> · massimo ${fmt(max,0)} ${U} in un mese</div></details>`;
}
function avvisiPotenza(S){
  const d=CASE[0].dati.luce; if(!d.presente || !Array.isArray(d.picchi) || !ok(d.potenza)) return [];
  const max=Math.max(...d.picchi.map(x=>x.v)); const out=[];
  if(max > d.potenza*1.1) out.push(`<b>Potenza</b>: il cliente ha <b>${fmt(d.potenza,1)} kW</b> impegnati ma ha avuto picchi fino a <b>${fmt(max,1)} kW</b>. Chiedigli se gli “salta” il contatore: è un argomento di consulenza (valutare un aumento di potenza con il distributore).`);
  else if(max < d.potenza*0.6) out.push(`<b>Potenza</b>: picchi massimi di ${fmt(max,1)} kW con ${fmt(d.potenza,1)} kW impegnati: potrebbe ridurre la potenza e pagare meno quota potenza.`);
  return out;
}

/* ---------- esiti, cliente promettente, combinazione consigliata ---------- */
function esitoCliente(S){
  if(S.tot1>=0 && S.energia>=0) return {k:'subito', testo:'✅ Conviene subito'};
  if(S.tot1>=0) return {k:'pacchetto', testo:'🧩 Conviene con il pacchetto TIM'};
  const sc=scadenzeCliente(S).filter(s=>s.mesi>=0).sort((a,b)=>parseData(a.data)-parseData(b.data))[0];
  let data = sc ? promemoriaDefault(sc.data) : null;
  if(!data){ data=new Date(); data.setMonth(data.getMonth()+3); }
  return {k:'nonora', testo:'⏰ Non ora: richiamo il '+data.toLocaleDateString('it-IT'), data};
}
function chipsPromettenti(S){
  const c=[]; const C=CLIENTE;
  for(const f of S.F){ const d=f.d, e=S.etF(f).toLowerCase();
    if(d.tipoPrezzo==='indicizzato') c.push(`${e}: prezzo indicizzato`);
    if(d.scadenzaPrezzo){ const m=mesiA(d.scadenzaPrezzo); if(m>=0 && m<=6) c.push(`${e}: prezzo in scadenza tra ${m} mesi`); }
    if(ok(d.quota) && d.quota>12) c.push(`${e}: quota fissa alta (${fmt(d.quota,2)} €/mese)`);
    if(ok(d.spread) && ((f.k==='luce'&&d.spread>0.02)||(f.k==='gas'&&d.spread>0.12))) c.push(`${e}: spread alto`);
    if(/tutele graduali/i.test(d.mercato||'')) c.push(`${e}: tutele graduali`);
  }
  if(C.internet===true && ok(C.costoInternet) && C.costoInternet > S.prezzoWifi+2) c.push(`internet caro (${fmt(C.costoInternet,2)} €/mese)`);
  if(C.sim===true && ok(C.costoSim) && C.costoSim > S.prezzoMob+2) c.push(`cellulare caro (${fmt(C.costoSim,2)} €/mese)`);
  if(!c.length) return '';
  return `<div class="promettente no-print"><b style="font-size:13px">🔥 Cliente promettente:</b>${[...new Set(c)].map(x=>`<span class="chip ok">${esc(x)}</span>`).join('')}</div>`;
}
function htmlCombinazione(S, ES){
  const inc=S.passi.filter(p=>p.incl && isFinite(p.a1));
  let h=`<div class="card"><h2>🧩 Combinazione TIM consigliata</h2><ul class="arg">${inc.map(p=>`<li><b>${esc(p.tit)}</b> <span class="${cls(p.a1)}">${eurS(p.a1)}</span> il 1° anno</li>`).join('')}</ul>`;
  if(ES.k==='nonora') h+=`<p>Oggi il passaggio non conviene al cliente. Proponi di risentirvi <b>${ES.data.toLocaleDateString('it-IT')}</b>${scadenzeCliente(S).length?', prima che scada il suo prezzo':''}.</p><div class="azioni no-print"><button class="btn picc" id="btnRichiamoDa">⏰ Aggiungi ai Richiami</button></div>`;
  else if(ES.k==='pacchetto') h+=`<p class="small">Sull'energia da sola il cliente spende un po' di più: la convenienza arriva unendo i servizi TIM della lista.</p>`;
  return h+'</div>';
}

/* ---------- bolletta completa IVA inclusa ---------- */
function aliquotaIVA(f){ if(f.k==='luce') return 0.10; const a=f.r.annuo||0; return a<=480 ? 0.10 : (480*0.10+(a-480)*0.22)/a; }
function htmlTotaleIVA(f){
  const d=f.d, x=f.r, iva=aliquotaIVA(f);
  if(VISTA==='bolletta'){
    const v=vistaValori(f); if(!v || !ok(d.totale)) return '';
    const tim=d.totale-(v.a-v.b)*(1+iva);
    return `<p class="small">🧾 <b>Totale bolletta (IVA inclusa)</b>: oggi <b>${eur(d.totale,2)}</b> → con TIM circa <b>${eur(tim,2)}</b>. Rete, oneri e imposte restano uguali${f.k==='luce'?'; l\'eventuale canone TV è compreso in entrambi':''}.</p>`;
  }
  if(!ok(d.spesaAnnua)) return '';
  const div=VISTA==='mese'?12:1, tim=d.spesaAnnua-x.diff*(1+iva);
  return `<p class="small">🧾 <b>Spesa ${VISTA==='mese'?'mensile media':'annua'} tutto compreso (IVA inclusa)</b>: oggi <b>${eur(d.spesaAnnua/div, div>1?2:0)}</b> → con TIM circa <b>${eur(tim/div, div>1?2:0)}</b> (stima sulla spesa annua dichiarata in bolletta).</p>`;
}

/* ---------- link al Portale Offerte ARERA nel riepilogo ---------- */
const ARERA_T = {
  it:'🔎 Puoi confrontare tutte le offerte anche sul Portale Offerte ARERA:', en:'🔎 You can compare all offers on the official ARERA portal:',
  ro:'🔎 Poți compara toate ofertele pe portalul oficial ARERA:', sq:'🔎 Mund t’i krahasosh të gjitha ofertat në portalin zyrtar ARERA:',
  ar:'🔎 يمكنك مقارنة جميع العروض على البوابة الرسمية ARERA:', zh:'🔎 您也可以在 ARERA 官方门户网站比较所有优惠：',
  uk:'🔎 Ви можете порівняти всі пропозиції на офіційному порталі ARERA:', es:'🔎 Puedes comparar todas las ofertas en el portal oficial de ARERA:',
  fr:'🔎 Vous pouvez comparer toutes les offres sur le portail officiel ARERA :'
};

/* ---------- preventivo PDF (senza dati personali) ---------- */
function preventivoPDF(S, ES){
  const q=negozio(); const oggi=new Date().toLocaleDateString('it-IT');
  const vend = (window.Cloud && Cloud.utente && Cloud.utente.nome) || q.vend || '';
  const righeF = S.F.map(f=>`<tr><td>${f.k==='luce'?'💡':'🔥'} ${esc(S.etF(f))}<br><small>${fmt(f.r.annuo,0)} ${f.r.U}/anno · ${esc(f.d.fornitore||'')}</small></td><td>${eur(f.r.attuale)}</td><td>${eur(f.r.tim)}</td><td class="${f.r.diff>=0?'p':'n'}">${eurS(f.r.diff)}</td></tr>`).join('');
  const passi = S.passi.filter(p=>p.incl && isFinite(p.a1) && p.id!=='energia').map(p=>`<tr><td>${esc(p.tit)}</td><td class="${p.a1>=0?'p':'n'}">${eurS(p.a1)}</td><td>${eurS(p.a2||0)}</td></tr>`).join('');
  const arg = argomenti(S).map(a=>`<li>${a.replace(/<a [^>]*>|<\/a>/g,'')}</li>`).join('');
  const w=window.open(''); if(!w){ alert('Consenti le finestre pop-up per creare il preventivo'); return; }
  w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Preventivo TIM Energia ${oggi}</title><style>
  @page{size:A4;margin:14mm}body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#1d2433;margin:0}
  .h{background:#0033A1;color:#fff;padding:16px 20px;border-bottom:4px solid #E2001A}.h h1{margin:0;font-size:24px}.h div{opacity:.9;font-size:13px;margin-top:4px}
  .b{padding:14px 4px}h2{color:#0033A1;font-size:16px;margin:16px 0 6px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#eaf0fb;text-align:left;padding:6px}td{padding:6px;border-bottom:1px solid #dde3ee}
  .p{color:#0a8a4a;font-weight:700}.n{color:#E2001A;font-weight:700}.v{background:#eaf0fb;border-left:5px solid #0033A1;padding:10px 12px;font-size:15px;margin-top:10px}
  li{margin:4px 0;font-size:13px}.f{font-size:11px;color:#5f6b80;margin-top:16px;border-top:1px solid #dde3ee;padding-top:8px}</style></head><body>
  <div class="h"><h1>Il tuo confronto TIM Energia</h1><div>${esc(q.nome||'Negozio TIM')}${q.num?' · '+esc(q.num):''}${q.ind?' · '+esc(q.ind):''} · ${oggi}${vend?' · consulente: '+esc(vend):''}</div></div>
  <div class="b"><div class="v"><b>${esc(ES.testo)}</b> — vantaggio stimato il 1° anno: <b>${eurS(S.tot1)}</b>${isFinite(S.tot2)?' · 2° anno: '+eurS(S.tot2):''}</div>
  <h2>Luce e gas: oggi e con TIM (all'anno, vendita IVA esclusa)</h2><table><tr><th>Fornitura</th><th>Oggi</th><th>Con TIM</th><th>Differenza</th></tr>${righeF}</table>
  ${passi?`<h2>Vantaggi TIM inclusi</h2><table><tr><th>Offerta</th><th>1° anno</th><th>2° anno</th></tr>${passi}</table>`:''}
  <h2>Perché TIM Energia</h2><ul>${arg}</ul>
  <div class="f">Stima indicativa basata sui dati della bolletta e sulle offerte TIM valide per sottoscrizioni entro il ${dataIT(L.luce.scadenza)}. Il confronto riguarda la spesa per la vendita (energia e quota fissa), IVA e imposte escluse: rete, oneri generali di sistema e imposte sono uguali per tutti i fornitori. Puoi confrontare le offerte anche sul Portale Offerte ARERA: www.ilportaleofferte.it</div></div>
  <script>setTimeout(()=>window.print(),300)<\/script></body></html>`);
  w.document.close();
}

/* ---------- schede: suggerimento PUN/PSV e “bolletta letta male” ---------- */
function renderSchedeExtra(){
  let h='';
  for(const k of ['luce','gas']){ const d=DATI[k]; if(!d.presente || !d.indice) continue; const cur=k==='luce'?L.luce.pun:L.gas.psv;
    h+=`<div class="avviso blu">📈 La bolletta indica ${esc(d.indice.nome)}${d.indice.mese?' di '+esc(d.indice.mese):''}: <b>${fmt(d.indice.valore,4)} ${k==='luce'?'€/kWh':'€/Smc'}</b>${d.indice.conPerdite?' (senza perdite di rete)':''}. Nel Listino c'è ${fmt(cur,4)}. <button class="btn sec picc" data-indice="${k}">Usalo nel Listino</button></div>`; }
  h+=`<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:200px">🛠️ La bolletta è stata letta male? Manda una segnalazione anonima: nomi, codici e indirizzi vengono tolti.</span><button class="btn sec picc" id="btnLettaMale">Bolletta letta male</button></div></div>`;
  $('#schedeExtra').innerHTML=h;
  document.querySelectorAll('[data-indice]').forEach(b=>b.onclick=()=>{
    if(!listinoModificabile()){ alert('Il Listino è protetto da PIN: sbloccalo nella pagina Listino.'); return; }
    const k=b.dataset.indice; if(k==='luce') L.luce.pun=DATI.luce.indice.valore; else L.gas.psv=DATI.gas.indice.valore;
    L.aggiornato=oggiISO(); try{ localStorage.setItem('listino', JSON.stringify(L)); }catch(e){} if(window.Cloud&&Cloud.isAdmin) Cloud.salvaListino(L);
    b.textContent='✅ Aggiornato'; DATI.luce.presente&&infoScheda('luce'); DATI.gas.presente&&infoScheda('gas');
  });
  $('#btnLettaMale').onclick=apriSegnalazione;
}
function anonimizza(t){
  const PAROLE=/bolletta|mercato|spesa|totale|luce|gas|energia|offerta|consum|lettur|pronto|info|dati|periodo|fattura|scontrino|box|riepilogo|fornitura|servizio|sintesi|dettaglio|importo|scadenza|quota|caratteristiche|elettric|naturale|storich|reclami|pagamenti|glossario/i;
  return t.split('\n').filter(l=>{
    if(/intestatari|codice\s+fiscale|c\.\s?f\.|indirizzo|^\s*(via|viale|piazza|p\.zza|corso|vicolo|località|loc\.|strada)\s|\biban\b|e-?mail|@|cellulare|telefono\s+cliente|data\s+di\s+nascita|codice\s+cliente|matricola|username|password|area\s+clienti/i.test(l)) return false;
    const s=l.trim(); if(/^[A-ZÀ-Ü'’ .]{4,45}$/.test(s) && s.split(/\s+/).length<=4 && !PAROLE.test(s)) return false; // probabili nomi o vie in maiuscolo
    return true;
  }).join('\n')
   .replace(/[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/gi,'[CF]')
   .replace(/\bIT\d{2}[A-Z]\d{10}[0-9A-Z]{12}\b/gi,'[IBAN]')
   .replace(/\bIT\s?\d{3}\s?E\s?[0-9A-Z]{7,9}\b/gi,'IT***E[POD]')
   .replace(/\b\d{14}\b/g,'[PDR]')
   .replace(/\b\d{7,}\b/g,'[numero]')
   .replace(/\b\d{5}\s+[A-Z][A-Za-zÀ-ú' ]+\s+\(?[A-Z]{2}\)?/g,'[CAP città]');
}
function apriSegnalazione(){
  const testo = anonimizza(testoUltimo||'');
  const dati = {luce:{}, gas:{}}; for(const k of ['luce','gas']){ const d=DATI[k]; if(!d.presente) continue; for(const f of ['fornitore','offerta','tipoPrezzo','qPeriodo','annuo','prezzo','quota','spesa','spesaConsumi','totale']) if(d[f]!==undefined) dati[k][f]=d[f]; }
  const msg = `Segnalazione TIM Bollette ${VERSIONE} – bolletta letta male\nFornitore: ${DATI.luce.fornitore||DATI.gas.fornitore||'?'}\nCosa è sbagliato: \n\nValori letti: ${JSON.stringify(dati)}\n\n--- testo anonimizzato ---\n${testo}`;
  const dest=(L.venditore&&L.venditore.segnalazioni)||'';
  apriModale(`<h2>🛠️ Bolletta letta male</h2><p class="small">Controlla che nel testo non siano rimasti nomi o indirizzi, scrivi cosa è sbagliato e invia.</p>
    <textarea id="segTesto" style="min-height:220px;font-size:12px">${esc(msg)}</textarea>
    <div class="azioni"><button class="btn verde picc" id="segInvia">Invia</button><button class="btn sec picc" id="segCopia">Copia</button><button class="btn sec picc" data-chiudi>Chiudi</button></div>
    <p class="small">${dest?'Destinatario: '+esc(dest):'Imposta il destinatario nel Listino (Sconti del venditore e segnalazioni).'}</p>`);
  $('#segCopia').onclick=async()=>{ try{ await navigator.clipboard.writeText($('#segTesto').value); $('#segCopia').textContent='✅ Copiato'; }catch(e){} };
  $('#segInvia').onclick=async()=>{
    const t=$('#segTesto').value; logEvento('segnalazione',{fornitore:DATI.luce.fornitore||DATI.gas.fornitore||''});
    if(dest.includes('@')){ location.href='mailto:'+dest+'?subject='+encodeURIComponent('TIM Bollette: bolletta letta male')+'&body='+encodeURIComponent(t.slice(0,1800)); return; }
    if(/\d{6,}/.test(dest.replace(/\D/g,''))){ window.open('https://wa.me/'+numeroWA(dest)+'?text='+encodeURIComponent(t.slice(0,3500)),'_blank'); return; }
    if(navigator.share){ try{ await navigator.share({text:t}); }catch(e){} } else $('#segCopia').click();
  };
}

/* ---------- obiezioni incontrate ---------- */
document.addEventListener('click', e=>{ const b=e.target.closest('[data-obinc]'); if(!b) return; logEvento('obiezione',{titolo:b.dataset.obinc}); b.textContent='✅ Segnata'; b.disabled=true; });

/* ---------- mini-quiz quando cambia il Listino ---------- */
function quizSeServe(){
  let fatto=''; try{ fatto=localStorage.getItem('quizListino')||''; }catch(e){}
  if(!fatto){ try{ localStorage.setItem('quizListino', L.aggiornato); }catch(e){} return; } // primo avvio: niente quiz
  if(fatto===L.aggiornato || (window.Cloud && Cloud.isAdmin)) return;
  const prezzoWifi = L.wifi.listino - L.wifi.scontoDue;
  const Q=[
    {q:'Per quanti mesi è bloccato il prezzo della luce TIM?', ok:String(L.luce.mesiBlocco), opz:[L.luce.mesiBlocco, 12, 36].map(String)},
    {q:'Quanto vale il bonus Special per ogni fornitura, il 1° anno?', ok:eur(L.luce.bonusMese*L.luce.bonusMesi), opz:[eur(L.luce.bonusMese*L.luce.bonusMesi), eur(L.luce.bonusMese*L.luce.bonusMesi+30), eur(Math.max(10,L.luce.bonusMese*L.luce.bonusMesi-25))]},
    {q:'Quanto costa WiFi Casa con luce e gas TIM?', ok:eur(prezzoWifi,2)+'/mese', opz:[eur(prezzoWifi,2)+'/mese', eur(L.wifi.listino,2)+'/mese', eur(prezzoWifi-4,2)+'/mese']}
  ].map(x=>({...x, opz:[...new Set(x.opz)].sort(()=>Math.random()-.5)}));
  let h=`<h2>🎓 Offerte aggiornate: 3 domande veloci</h2><p class="small">Il Listino è cambiato (${dataIT(L.aggiornato)}). Rispondi per ripassare le offerte nuove.</p>`;
  Q.forEach((x,i)=>{ h+=`<p style="margin:12px 0 6px"><b>${i+1}. ${esc(x.q)}</b></p><div class="seg" data-quiz="${i}">${x.opz.map(o=>`<button data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`; });
  h+=`<div class="azioni"><button class="btn" id="quizFine">Verifica</button></div><p id="quizEsito"></p>`;
  apriModale(h);
  const risp={};
  document.querySelectorAll('[data-quiz]').forEach(g=>g.onclick=e=>{ const b=e.target.closest('button'); if(!b) return; g.querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); risp[g.dataset.quiz]=b.dataset.v; });
  $('#quizFine').onclick=()=>{
    let giusti=0; Q.forEach((x,i)=>{ const g=document.querySelector(`[data-quiz="${i}"]`); g.querySelectorAll('button').forEach(b=>{ if(b.dataset.v===x.ok) b.style.background='#e3f5ea'; }); if(risp[i]===x.ok) giusti++; });
    $('#quizEsito').innerHTML=`<b>${giusti} su 3</b> ${giusti===3?'🎉 Perfetto!':'— le risposte giuste sono in verde.'}`;
    try{ localStorage.setItem('quizListino', L.aggiornato); }catch(e){}
    logEvento('quiz',{giusti, listino:L.aggiornato});
    $('#quizFine').textContent='Chiudi'; $('#quizFine').onclick=chiudiModale;
  };
}

/* ---------- scadenziario richiami (cifrato) ---------- */
let RICH_KEY=null, RICHIAMI=[], RICH_TIMER=null, RICH_BOZZA=null;
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c=>c.charCodeAt(0));
async function derivaChiave(pw, salt){ const base=await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:150000, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']); }
function archivioRichiami(){ try{ return JSON.parse(localStorage.getItem('richiami_enc')||'null'); }catch(e){ return null; } }
async function salvaRichiami(){
  const a=archivioRichiami(); const iv=crypto.getRandomValues(new Uint8Array(12));
  const dati=await crypto.subtle.encrypt({name:'AES-GCM', iv}, RICH_KEY, new TextEncoder().encode(JSON.stringify(RICHIAMI)));
  localStorage.setItem('richiami_enc', JSON.stringify({salt:a.salt, iv:b64(iv), dati:b64(new Uint8Array(dati))}));
  aggiornaMetaRichiami();
}
function aggiornaMetaRichiami(){ try{ localStorage.setItem('richiami_meta', JSON.stringify(RICHIAMI.filter(r=>!r.fatto).map(r=>r.data))); }catch(e){} badgeRichiami(); }
function badgeRichiami(){ let m=[]; try{ m=JSON.parse(localStorage.getItem('richiami_meta')||'[]'); }catch(e){} const lim=new Date(); lim.setDate(lim.getDate()+7); const n=m.filter(d=>new Date(d)<=lim).length; const b=$('#badgeRichiami'); b.style.display=n?'':'none'; b.textContent=n; }
function riarmaBlocco(){ clearTimeout(RICH_TIMER); RICH_TIMER=setTimeout(()=>{ RICH_KEY=null; RICHIAMI=[]; if($('#p-richiami').classList.contains('on')) renderRichiami(); }, 15*60*1000); }
async function sbloccaRichiami(pw){
  const a=archivioRichiami(); const key=await derivaChiave(pw, unb64(a.salt));
  try{ const pt=await crypto.subtle.decrypt({name:'AES-GCM', iv:unb64(a.iv)}, key, unb64(a.dati)); RICHIAMI=JSON.parse(new TextDecoder().decode(pt)); RICH_KEY=key; riarmaBlocco(); return true; }catch(e){ return false; }
}
async function creaArchivio(pw){ const salt=crypto.getRandomValues(new Uint8Array(16)); localStorage.setItem('richiami_enc', JSON.stringify({salt:b64(salt)})); RICH_KEY=await derivaChiave(pw, salt); RICHIAMI=[]; await salvaRichiami(); riarmaBlocco(); }
function renderRichiami(){
  const box=$('#richiamiBox'); const a=archivioRichiami();
  if(!a){ box.innerHTML=`<div class="avviso blu">Prima volta: scegli una password per proteggere i richiami (almeno 6 caratteri). Senza password i dati non si possono leggere: non dimenticarla.</div>
    <div class="campi"><label class="c">Password<input type="password" id="rpw1"></label><label class="c">Ripeti password<input type="password" id="rpw2"></label></div>
    <div class="azioni"><button class="btn" id="rCrea">Crea lo scadenziario</button></div><p class="small" id="rMsg"></p>`;
    $('#rCrea').onclick=async()=>{ const p1=$('#rpw1').value, p2=$('#rpw2').value; if(p1.length<6){ $('#rMsg').textContent='Almeno 6 caratteri'; return; } if(p1!==p2){ $('#rMsg').textContent='Le password non coincidono'; return; } await creaArchivio(p1); renderRichiami(); };
    return; }
  if(!RICH_KEY){ box.innerHTML=`<div class="lock">🔒 Inserisci la password dello scadenziario<br><input type="password" id="rpw" style="font-size:18px;padding:8px;margin-top:8px;border:1px solid var(--linea);border-radius:10px"><div class="azioni" style="justify-content:center"><button class="btn" id="rApri">Apri</button></div><p class="small" id="rMsg"></p></div>`;
    $('#rApri').onclick=async()=>{ if(await sbloccaRichiami($('#rpw').value)) renderRichiami(); else $('#rMsg').textContent='Password errata'; };
    $('#rpw').onkeydown=e=>{ if(e.key==='Enter') $('#rApri').click(); };
    return; }
  riarmaBlocco();
  const oggi=new Date(); oggi.setHours(0,0,0,0); const lim=new Date(oggi); lim.setDate(lim.getDate()+7);
  const lista=[...RICHIAMI].sort((x,y)=>(x.fatto-y.fatto)||(new Date(x.data)-new Date(y.data)));
  const q=negozio();
  let h=`<div class="azioni" style="margin-top:0"><button class="btn picc" id="rNuovo">+ Nuovo richiamo</button><button class="btn sec picc" id="rBlocca">🔒 Blocca</button></div><div id="rForm"></div>`;
  if(!lista.length) h+='<p class="small">Nessun richiamo salvato.</p>';
  for(const r of lista){ const d=new Date(r.data); const scade=!r.fatto && d<=lim;
    const msg=`Ciao ${r.nome}, sono ${(window.Cloud&&Cloud.utente&&Cloud.utente.nome)||q.vend||''} di ${q.nome||'TIM'}. Come d'accordo ti ricontatto per la bolletta luce e gas: il prezzo della tua offerta sta per scadere. Passi in negozio per un nuovo check-up?`;
    h+=`<div class="rich ${scade?'scade':''} ${r.fatto?'fatto':''}"><b>${esc(r.nome)}</b> · ${esc(r.tel)}<br><span class="small">Richiamare il <b>${d.toLocaleDateString('it-IT')}</b>${r.scadenza?' · prezzo in scadenza il '+esc(r.scadenza):''}${r.note?'<br>'+esc(r.note):''}</span>
      <div class="azioni" style="margin-top:6px"><a class="btn verde picc" href="https://wa.me/${numeroWA(r.tel)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn sec picc" href="tel:${esc(r.tel.replace(/\s/g,''))}">Chiama</a><button class="btn sec picc" data-rfatto="${r.id}">${r.fatto?'↩︎ Da fare':'✓ Fatto'}</button><button class="btn sec picc" data-rdel="${r.id}">🗑️</button></div></div>`; }
  box.innerHTML=h;
  $('#rBlocca').onclick=()=>{ RICH_KEY=null; RICHIAMI=[]; renderRichiami(); };
  $('#rNuovo').onclick=()=>formRichiamo({});
  box.querySelectorAll('[data-rfatto]').forEach(b=>b.onclick=async()=>{ const r=RICHIAMI.find(x=>x.id===b.dataset.rfatto); r.fatto=!r.fatto; await salvaRichiami(); renderRichiami(); });
  box.querySelectorAll('[data-rdel]').forEach(b=>b.onclick=async()=>{ if(!confirm('Eliminare questo richiamo?')) return; RICHIAMI=RICHIAMI.filter(x=>x.id!==b.dataset.rdel); await salvaRichiami(); renderRichiami(); });
  if(RICH_BOZZA){ formRichiamo(RICH_BOZZA); RICH_BOZZA=null; }
}
function formRichiamo(p){
  const d=p.data? dataInput(p.data) : (()=>{ const x=new Date(); x.setMonth(x.getMonth()+3); return dataInput(x); })();
  $('#rForm').innerHTML=`<div class="card" style="border-color:#b8cbef"><div class="campi">
    <label class="c">Nome di riferimento<input id="rNome" placeholder="es. Sig.ra Rossi"></label><label class="c">Telefono<input id="rTel" inputmode="tel"></label>
    <label class="c">Data del richiamo<input id="rData" type="date" value="${d}"></label><label class="c">Scadenza prezzo<input id="rScad" value="${esc(p.scadenza||'')}" placeholder="gg/mm/aaaa"></label></div>
    <label class="c" style="margin-top:8px">Note<input id="rNote" value="${esc(p.note||'')}"></label>
    <label class="small" style="display:block;margin-top:8px"><input type="checkbox" id="rCons"> Il cliente ha dato il <b>consenso</b> a essere ricontattato dal negozio</label>
    <div class="azioni"><button class="btn picc" id="rSalva">Salva</button><button class="btn sec picc" id="rAnn">Annulla</button></div><p class="small" id="rErr"></p></div>`;
  $('#rAnn').onclick=()=>$('#rForm').innerHTML='';
  $('#rSalva').onclick=async()=>{
    if(!$('#rCons').checked){ $('#rErr').textContent='Senza consenso del cliente il richiamo non si può salvare.'; return; }
    const nome=$('#rNome').value.trim(), tel=$('#rTel').value.trim(); if(!nome||!tel){ $('#rErr').textContent='Inserisci nome e telefono'; return; }
    RICHIAMI.push({id:Date.now().toString(36), nome, tel, data:$('#rData').value, scadenza:$('#rScad').value.trim(), note:$('#rNote').value.trim(), consenso:true, creato:oggiISO(), fatto:false});
    await salvaRichiami(); logEvento('richiamo',{}); renderRichiami();
  };
}
function apriNuovoRichiamo(S, ES){
  const sc=scadenzeCliente(S).map(s=>s.data).join(' / ');
  const f=S.F[0]; RICH_BOZZA={data:ES.data, scadenza:sc, note:`${f.d.fornitore||''} ${f.d.offerta?'('+f.d.offerta+')':''} · differenza ${eurS(S.tot1)} il 1° anno`.trim()};
  vai('richiami');
}

/* ---------- invio su WhatsApp di tutti i QR ---------- */
function elencoQR(){
  const q=negozio(); const haNum=numeroWA(q.num).length>=9; const vend=($('#qrVend')&&$('#qrVend').value.trim())||q.vend||'';
  const L1=[];
  L1.push({id:'cartello', nome:'Cartello “Check-up bolletta”', desc:'cartello completo da stampare'+(vend?' (consulente: '+vend+')':''), ok:haNum, manca:'inserisci il cellulare del negozio',
    crea:()=>{ disegnaCartello(q.nome, q.num, urlCheckup(), vend); return $('#qrCanvas'); }, file:'QR-checkup'});
  L1.push({id:'solo', nome:'Solo QR “Check-up” per la locandina', desc:'da stampare 8 × 8 cm', ok:haNum, manca:'inserisci il cellulare del negozio',
    crea:()=>{ const c=document.createElement('canvas'); canvasSoloQR(c, urlCheckup(), vend?'Check-up bolletta · '+vend:'Check-up bolletta'); return c; }, file:'QR-solo-checkup'});
  L1.push({id:'recensione', nome:'QR recensione Google', desc:'per la locandina “Recensioni”', ok:!!q.review, manca:'inserisci il link per le recensioni',
    crea:()=>{ const c=document.createElement('canvas'); canvasSoloQR(c, q.review, '★ Lascia una recensione'); return c; }, file:'QR-recensione'});
  L1.push({id:'rubricaTIM', nome:'QR rubrica TIM Energia', desc:'il cliente salva i numeri di TIM Energia', ok:true,
    crea:()=>{ const c=document.createElement('canvas'); canvasSoloQR(c, VCARD_TIM, 'Salva TIM Energia'); return c; }, file:'QR-rubrica-TIM-Energia'});
  L1.push({id:'adesivo', nome:'Adesivo contatti TIM Energia', desc:'QR rubrica con i numeri utili, da spillare al contratto', ok:true,
    crea:()=>disegnaAdesivo(), file:'adesivo-contatti-TIM-Energia'});
  const vn=vcardNegozio();
  L1.push({id:'rubricaNeg', nome:'QR rubrica del negozio', desc:'il cliente salva il negozio in rubrica', ok:!!vn, manca:'inserisci i dati del negozio',
    crea:()=>{ const c=document.createElement('canvas'); canvasSoloQR(c, vcardNegozio(), 'Salva '+(q.nome||'il negozio')); return c; }, file:'QR-rubrica-negozio'});
  return L1;
}
async function blobDa(cv){ return new Promise(r=>cv.toBlob(r,'image/png')); }
async function inviaUnQR(it){
  const cv=it.crea(); logEvento('qr',{tipo:'invio', quale:it.id});
  await condividiCanvas(cv, nomeFile(it.file), it.nome+' – '+it.desc, negozio().num);
}
async function inviaTuttiQR(lista){
  const files=[]; for(const it of lista){ const b=await blobDa(it.crea()); files.push(new File([b], nomeFile(it.file), {type:'image/png'})); }
  logEvento('qr',{tipo:'invio', quale:'tutti', n:files.length});
  if(navigator.canShare && navigator.canShare({files})){ try{ await navigator.share({files, text:'QR del negozio: '+lista.map(x=>x.nome).join(', ')}); }catch(e){} return; }
  for(const f of files){ const a=document.createElement('a'); a.href=URL.createObjectURL(f); a.download=f.name; a.click(); await new Promise(r=>setTimeout(r,400)); }
  alert('Immagini scaricate: allegale alla chat WhatsApp.');
  const q=negozio(); if(numeroWA(q.num).length>=9) window.open('https://wa.me/'+numeroWA(q.num)+'?text='+encodeURIComponent('QR del negozio (immagini allegate)'),'_blank');
}
function apriInvioQR(){
  try{ salvaNegozio(); }catch(e){}
  const lista=elencoQR(); const pronti=lista.filter(x=>x.ok);
  let h=`<h2>📲 Invia i QR su WhatsApp</h2><p class="small">Tocca “Invia” e scegli WhatsApp (o un'altra app) e la chat a cui mandarlo.</p>`;
  lista.forEach((it,i)=>{ h+=`<div class="riga-ct" style="display:flex;gap:10px;align-items:center"><span style="flex:1"><b>${esc(it.nome)}</b><span class="small">${esc(it.ok?it.desc:'⚠️ '+it.manca+' nella pagina QR negozio')}</span></span><button class="btn ${it.ok?'verde':'sec'} picc" data-inviaqr="${i}" ${it.ok?'':'disabled'}>Invia</button></div>`; });
  h+=`<div class="azioni"><button class="btn verde" id="qrTutti" ${pronti.length?'':'disabled'}>Invia tutti insieme (${pronti.length})</button><button class="btn sec" data-chiudi>Chiudi</button></div>`;
  apriModale(h);
  document.querySelectorAll('[data-inviaqr]').forEach(b=>b.onclick=async()=>{ await inviaUnQR(lista[+b.dataset.inviaqr]); b.textContent='✅ Inviato'; });
  $('#qrTutti').onclick=()=>inviaTuttiQR(pronti);
}
$('#btnInviaQR').onclick=apriInvioQR;

/* ---------- avvio ---------- */
badgeRichiami();
controllaVersione();
try{ if(!localStorage.getItem('guidaVista')) setTimeout(apriGuida, 600); }catch(e){}
