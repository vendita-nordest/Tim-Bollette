/* TIM Bollette – Firebase: accesso venditori, registro attività, Listino unico, area Amministratore */
"use strict";
const Cloud = { attivo:false, isAdmin:false, utente:null, user:null, db:null, auth:null };
window.Cloud = Cloud;
const COL = { utenti:'bollette_utenti', eventi:'bollette_eventi', config:'bollette_config' };

async function avviaCloud(){
  if(!window.FIREBASE_CONFIG) return;
  try{
    if(!window.firebase){ for(const f of ['firebase-app-compat.js','firebase-auth-compat.js','firebase-firestore-compat.js']) await caricaScript('lib/firebase/'+f); }
    if(!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    Cloud.auth = firebase.auth(); Cloud.db = firebase.firestore();
    try{ await Cloud.db.enablePersistence({synchronizeTabs:true}); }catch(e){}
    Cloud.auth.onAuthStateChanged(u=>{ u ? entra(u) : mostraLogin(); });
  }catch(e){ console.error('Firebase', e); }
}

function mostraLogin(msg){
  Cloud.attivo=false; Cloud.isAdmin=false; Cloud.utente=null; aggiornaTestata();
  apriModale(`<h2>Accedi a TIM Bollette</h2><p class="small">Usa le credenziali che ti ha dato il tuo responsabile.</p>
    <label class="c">Email<input id="lgEmail" type="email" autocomplete="username"></label>
    <label class="c" style="margin-top:8px">Password<input id="lgPw" type="password" autocomplete="current-password"></label>
    <div class="azioni"><button class="btn" id="lgEntra">Entra</button><button class="btn sec picc" id="lgReset">Password dimenticata?</button></div>
    <p class="small" id="lgMsg" style="color:var(--rosso)">${esc(msg||'')}</p>`);
  $('#modale').dataset.bloccato='1';
  $('#lgEntra').onclick=async()=>{ $('#lgMsg').textContent=''; try{ await Cloud.auth.signInWithEmailAndPassword($('#lgEmail').value.trim(), $('#lgPw').value); }catch(e){ $('#lgMsg').textContent='Accesso non riuscito: controlla email e password.'; } };
  $('#lgPw').onkeydown=e=>{ if(e.key==='Enter') $('#lgEntra').click(); };
  $('#lgReset').onclick=async()=>{ const em=$('#lgEmail').value.trim(); if(!em){ $('#lgMsg').textContent='Scrivi prima la tua email'; return; } try{ await Cloud.auth.sendPasswordResetEmail(em); $('#lgMsg').style.color='var(--verde)'; $('#lgMsg').textContent='Ti abbiamo mandato una email per reimpostare la password.'; }catch(e){ $('#lgMsg').textContent='Email non riconosciuta.'; } };
}
// il login non si chiude toccando fuori
$('#modale').addEventListener('click', e=>{ if($('#modale').dataset.bloccato==='1' && e.target.id==='modale'){ e.stopImmediatePropagation(); $('#modale').classList.add('on'); } }, true);

async function entra(u){
  Cloud.user=u;
  const admin = (window.ADMIN_EMAILS||[]).map(x=>x.toLowerCase()).includes((u.email||'').toLowerCase());
  let prof=null; try{ const s=await Cloud.db.collection(COL.utenti).doc(u.uid).get(); if(s.exists) prof=s.data(); }catch(e){}
  if(!admin && (!prof || prof.attivo===false)){ await Cloud.auth.signOut(); mostraLogin('Questo account non è abilitato a TIM Bollette: contatta il tuo responsabile.'); return; }
  Cloud.isAdmin = admin || (prof && prof.ruolo==='admin');
  Cloud.utente = Object.assign({nome:(u.email||'').split('@')[0], negozio:'', insegna:''}, prof||{}, {email:u.email});
  Cloud.attivo = true;
  delete $('#modale').dataset.bloccato; chiudiModale();
  try{ if(!localStorage.getItem('guidaVista')) setTimeout(apriGuida,300); }catch(e){}
  aggiornaTestata();
  ascoltaListino();
  logEvento('accesso',{});
}
function aggiornaTestata(){
  const b=$('#btnUtente'), ini=$('#iniziali');
  $('#navAdmin').style.display = Cloud.isAdmin ? '' : 'none';
  if(!Cloud.utente){ b.style.display='none'; ini.textContent='J.C.P.'; return; }
  b.style.display=''; b.textContent='👤'; b.title=Cloud.utente.nome;
  ini.textContent = Cloud.isAdmin ? 'J.C.P.' : (Cloud.utente.nome||'').split(/\s+/).map(x=>x[0]).join('.').toUpperCase()+'.';
}
$('#btnUtente').onclick=()=>{
  const u=Cloud.utente; if(!u) return;
  apriModale(`<h2>👤 ${esc(u.nome)}</h2><p>${esc(u.email)}<br>${esc(u.negozio||'')}${u.insegna?' · '+esc(u.insegna):''}${Cloud.isAdmin?'<br><b>Amministratore</b>':''}</p>
    <div class="azioni"><button class="btn sec" id="btnEsci">Esci</button><button class="btn" data-chiudi>Chiudi</button></div>`);
  $('#btnEsci').onclick=async()=>{ logEvento('uscita',{}); await Cloud.auth.signOut(); };
};

/* ---------- registro attività: solo azioni, mai dati dei clienti ---------- */
Cloud.evento = (tipo, dati)=>{
  if(!Cloud.attivo) return;
  const u=Cloud.utente;
  Cloud.db.collection(COL.eventi).add({ uid:Cloud.user.uid, nome:u.nome||'', negozio:u.negozio||'', insegna:u.insegna||'', tipo, dati:dati||{},
    admin: !!Cloud.isAdmin, ts: firebase.firestore.FieldValue.serverTimestamp(), giorno: oggiISO(), versione: VERSIONE }).catch(e=>console.warn('evento',e));
};

/* ---------- Listino unico ---------- */
let stopListino=null;
function ascoltaListino(){
  if(stopListino) stopListino();
  stopListino = Cloud.db.collection(COL.config).doc('listino').onSnapshot(s=>{
    if(!s.exists) return; const c=s.data();
    window.PIN_CENTRALE = c.pinHash || '';
    if(c.listino){ for(const k in c.listino){ if(L[k] && typeof c.listino[k]==='object') Object.assign(L[k], c.listino[k]); else L[k]=c.listino[k]; }
      try{ localStorage.setItem('listino', JSON.stringify(L)); }catch(e){}
      avvisoListino(); if($('#p-listino').classList.contains('on')){ renderListino(); renderLock(); }
      quizSeServe(); }
  }, e=>console.warn('listino', e));
}
Cloud.salvaListino = (lis)=>{ if(!Cloud.isAdmin) return; Cloud.db.collection(COL.config).doc('listino').set({listino:JSON.parse(JSON.stringify(lis)), aggiornato:lis.aggiornato, da:Cloud.user.email}, {merge:true}).catch(e=>alert('Listino non salvato online: '+e.message)); };
Cloud.salvaPin = (h)=>{ if(!Cloud.isAdmin) return; Cloud.db.collection(COL.config).doc('listino').set({pinHash:h}, {merge:true}); };

/* ===================== AREA AMMINISTRATORE ===================== */
let ADM = { giorni:30, eventi:[], utenti:[] };
const ETICH = { checkup:'Check-up', subito:'Subito', pacchetto:'Con pacchetto', nonora:'Non ora', riepilogo:'Riepiloghi', preventivo:'Preventivi', qr:'QR', promemoria:'Promemoria', richiamo:'Richiami', obiezione:'Obiezioni', contatti:'Contatti inviati', segnalazione:'Segnalazioni', accesso:'Accessi' };
async function renderAdmin(){
  const box=$('#adminBox');
  if(!window.FIREBASE_CONFIG){ box.innerHTML=`<div class="card"><h2>🛡️ Area Amministratore</h2><p>Per vedere chi usa l'app serve collegarla a Firebase: apri il file <b>firebase-config.js</b> nel repository e incolla la configurazione del progetto (le istruzioni sono nel README).</p></div>`; return; }
  if(!Cloud.isAdmin){ box.innerHTML='<div class="card"><p>Area riservata all\'amministratore.</p></div>'; return; }
  box.innerHTML='<div class="card"><p>Caricamento dati…</p></div>';
  try{
    const da=new Date(); da.setDate(da.getDate()-Math.max(ADM.giorni,14)); da.setHours(0,0,0,0);
    const [ev, ut] = await Promise.all([
      Cloud.db.collection(COL.eventi).where('ts','>=',firebase.firestore.Timestamp.fromDate(da)).get(),
      Cloud.db.collection(COL.utenti).get()
    ]);
    ADM.eventi = ev.docs.map(d=>{ const x=d.data(); return Object.assign(x,{data: x.ts && x.ts.toDate ? x.ts.toDate() : new Date(x.giorno)}); }).filter(x=>!x.admin);
    ADM.utenti = ut.docs.map(d=>Object.assign({uid:d.id}, d.data()));
    disegnaAdmin();
  }catch(e){ box.innerHTML=`<div class="card"><div class="avviso rosso">Errore nel caricare i dati: ${esc(e.message)}. Controlla le regole di Firestore (README).</div></div>`; }
}
function aggrega(eventi, chiave){
  const m={};
  for(const e of eventi){ const k=chiave(e); if(!k) continue; const r=m[k]=m[k]||{chiave:k, insegna:e.insegna||'', checkup:0, subito:0, pacchetto:0, nonora:0, riepilogo:0, preventivo:0, qr:0, promemoria:0, richiamo:0, obiezione:0, quizN:0, quizOk:0, ultimo:null, vantaggio:0};
    if(e.tipo==='checkup'){ r.checkup++; if(e.dati&&e.dati.esito) r[e.dati.esito]=(r[e.dati.esito]||0)+1; if(e.dati&&isFinite(e.dati.vantaggio)) r.vantaggio+=e.dati.vantaggio; }
    else if(e.tipo==='quiz'){ r.quizN++; r.quizOk+=(e.dati&&e.dati.giusti)||0; }
    else if(r[e.tipo]!==undefined) r[e.tipo]++;
    if(e.tipo!=='accesso' && e.tipo!=='uscita' && (!r.ultimo || e.data>r.ultimo)) r.ultimo=e.data; }
  return Object.values(m).sort((a,b)=>b.checkup-a.checkup);
}
const COLS=['checkup','subito','pacchetto','nonora','riepilogo','preventivo','qr','promemoria','richiamo','obiezione'];
function tabella(righe, primaCol, conInsegna){
  const oggi=new Date(); const lim=new Date(); lim.setDate(lim.getDate()-7);
  let h=`<div style="overflow-x:auto;max-height:420px"><table class="adm"><thead><tr><th>${primaCol}</th>${conInsegna?'<th>Insegna</th>':''}${COLS.map(c=>`<th style="text-align:right">${ETICH[c]}</th>`).join('')}<th style="text-align:right">Quiz</th><th>Ultimo uso</th></tr></thead><tbody>`;
  for(const r of righe){ const ina=!r.ultimo || r.ultimo<lim;
    h+=`<tr class="${ina?'inattivo':''}"><td><b>${esc(r.chiave)}</b></td>${conInsegna?`<td>${esc(r.insegna)}</td>`:''}${COLS.map(c=>`<td class="n">${r[c]||0}</td>`).join('')}<td class="n">${r.quizN?Math.round(r.quizOk/r.quizN/3*100)+'%':'—'}</td><td>${r.ultimo?r.ultimo.toLocaleDateString('it-IT'):'mai'}</td></tr>`; }
  return h+'</tbody></table></div>';
}
function disegnaAdmin(){
  const box=$('#adminBox'); const da=new Date(); da.setDate(da.getDate()-ADM.giorni);
  const ev=ADM.eventi.filter(e=>e.data>=da);
  const perNeg=aggrega(ev, e=>e.negozio||'(senza negozio)');
  // includo i negozi che non hanno mai usato l'app
  for(const u of ADM.utenti){ if(u.negozio && !perNeg.find(r=>r.chiave===u.negozio) && u.attivo!==false) perNeg.push({chiave:u.negozio, insegna:u.insegna||'', ultimo:null}); }
  const perVend=aggrega(ev, e=>e.nome||e.uid);
  // avvisi
  const lim7=new Date(); lim7.setDate(lim7.getDate()-7); const lim14=new Date(); lim14.setDate(lim14.getDate()-14);
  const inattivi=perNeg.filter(r=>!r.ultimo || r.ultimo<lim7).map(r=>r.chiave);
  const sett=(n,a,b)=>ADM.eventi.filter(e=>e.tipo==='checkup' && (e.negozio||'')===n && e.data>=a && e.data<b).length;
  const variazioni=[]; const ora=new Date();
  for(const r of perNeg){ const q=sett(r.chiave,lim7,ora), p=sett(r.chiave,lim14,lim7); if(p>=3 && Math.abs(q-p)/p>=0.3) variazioni.push(`${r.chiave}: ${q} check-up questa settimana (${q>p?'+':''}${Math.round((q-p)/p*100)}% sulla precedente)`); }
  // obiezioni e fornitori
  const conta=(arr)=>{ const m={}; arr.forEach(x=>{ if(x) m[x]=(m[x]||0)+1; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]); };
  const obiez=conta(ev.filter(e=>e.tipo==='obiezione').map(e=>e.dati&&e.dati.titolo));
  const forn=conta(ev.filter(e=>e.tipo==='checkup').flatMap(e=>(e.dati&&e.dati.fornitori)||[]));
  const tot=perNeg.reduce((a,r)=>({c:a.c+(r.checkup||0), s:a.s+(r.subito||0), p:a.p+(r.pacchetto||0), n:a.n+(r.nonora||0)}),{c:0,s:0,p:0,n:0});
  let h=`<div class="card"><h2>🛡️ Area Amministratore</h2>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">Periodo: <span class="seg" id="admGiorni">${[7,30,90].map(g=>`<button data-g="${g}" class="${ADM.giorni===g?'on':''}">${g} giorni</button>`).join('')}</span><button class="btn sec picc" id="admAggiorna">↻ Aggiorna</button></div>
    <div class="confronto" style="margin-top:12px"><div>Check-up<b>${tot.c}</b></div><div>Convenienti<b class="pos">${tot.s+tot.p}</b><span class="small">${tot.s} subito · ${tot.p} con pacchetto</span></div><div>Non ora<b>${tot.n}</b><span class="small">da richiamare</span></div></div></div>`;
  h+=`<div class="card"><h2>🔔 Avvisi</h2>${inattivi.length?`<p>⚠️ <b>Negozi senza attività da almeno 7 giorni:</b> ${inattivi.map(esc).join(', ')}</p>`:'<p>Tutti i negozi hanno usato l\'app negli ultimi 7 giorni.</p>'}${variazioni.length?'<ul class="arg">'+variazioni.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>':''}</div>`;
  h+=`<div class="card"><h2>🏪 Report per negozio <span class="small" style="font-weight:400">(si può inviare)</span></h2>${tabella(perNeg,'Negozio',true)}
    <div class="azioni"><button class="btn picc" id="admXlsNeg">⬇️ Excel</button><button class="btn sec picc" id="admInviaNeg">Invia</button><button class="btn verde picc" id="admClassifica">🏆 Classifica settimanale per insegna (WhatsApp)</button></div></div>`;
  h+=`<div class="card" style="border-color:#f3a2ab"><h2>👥 Report per addetto <span class="small" style="font-weight:400">(riservato: solo tu lo vedi, non si esporta)</span></h2>${tabella(perVend,'Addetto',false)}</div>`;
  h+=`<div class="griglia due"><div class="card"><h2>💬 Obiezioni più frequenti</h2>${obiez.length?'<ol>'+obiez.slice(0,10).map(([k,v])=>`<li>${esc(k)} — <b>${v}</b></li>`).join('')+'</ol>':'<p class="small">Nessuna obiezione segnata.</p>'}</div>
    <div class="card"><h2>⚡ Fornitori più frequenti</h2>${forn.length?'<ol>'+forn.slice(0,10).map(([k,v])=>`<li>${esc(k)} — <b>${v}</b></li>`).join('')+'</ol>':'<p class="small">Nessun check-up.</p>'}</div></div>`;
  h+=`<div class="card"><h2>🧑‍💼 Venditori e negozi</h2><div style="overflow-x:auto"><table class="adm"><thead><tr><th>Nome</th><th>Email</th><th>Negozio</th><th>Insegna</th><th>Ruolo</th><th>Attivo</th><th></th></tr></thead><tbody>
    ${ADM.utenti.map(u=>`<tr><td><input data-u="${u.uid}" data-f="nome" value="${esc(u.nome||'')}"></td><td class="small">${esc(u.email||'')}</td><td><input data-u="${u.uid}" data-f="negozio" value="${esc(u.negozio||'')}"></td><td><input data-u="${u.uid}" data-f="insegna" value="${esc(u.insegna||'')}"></td>
      <td><select data-u="${u.uid}" data-f="ruolo"><option value="venditore" ${u.ruolo!=='admin'?'selected':''}>venditore</option><option value="admin" ${u.ruolo==='admin'?'selected':''}>admin</option></select></td><td><input type="checkbox" data-u="${u.uid}" data-f="attivo" ${u.attivo!==false?'checked':''}></td><td><button class="btn sec picc" data-salvau="${u.uid}">Salva</button></td></tr>`).join('')}
    </tbody></table></div>
    <h3>Aggiungi venditore</h3><div class="campi"><label class="c">Nome e cognome<input id="nuNome"></label><label class="c">Email<input id="nuEmail" type="email"></label><label class="c">Password provvisoria (min 6)<input id="nuPw"></label><label class="c">Negozio<input id="nuNeg"></label><label class="c">Insegna<input id="nuIns"></label></div>
    <div class="azioni"><button class="btn picc" id="nuCrea">Crea account</button></div><p class="small" id="nuMsg"></p>
    <p class="small">Il venditore entra con email e password provvisoria e può cambiarla con “Password dimenticata?”.</p></div>`;
  h+=`<div class="card"><h2>🔗 Incrocio con l'app Energia</h2><p class="small">Per vedere quanti check-up diventano contratti attivati serve collegare i dati dell'app Energia (stesso Firebase): da fare nel prossimo passaggio.</p></div>`;
  box.innerHTML=h;
  $('#admGiorni').onclick=e=>{ const b=e.target.closest('button'); if(!b) return; ADM.giorni=+b.dataset.g; if(ADM.giorni>30) renderAdmin(); else disegnaAdmin(); };
  $('#admAggiorna').onclick=renderAdmin;
  $('#admXlsNeg').onclick=()=>esportaNegozi(perNeg,false);
  $('#admInviaNeg').onclick=()=>esportaNegozi(perNeg,true);
  $('#admClassifica').onclick=()=>classificaInsegne();
  box.querySelectorAll('[data-salvau]').forEach(b=>b.onclick=async()=>{ const uid=b.dataset.salvau; const dati={}; box.querySelectorAll(`[data-u="${uid}"]`).forEach(i=>{ dati[i.dataset.f]= i.type==='checkbox'? i.checked : i.value.trim(); });
    try{ await Cloud.db.collection(COL.utenti).doc(uid).set(dati,{merge:true}); b.textContent='✅'; }catch(e){ alert(e.message); } });
  $('#nuCrea').onclick=creaVenditore;
}
async function creaVenditore(){
  const nome=$('#nuNome').value.trim(), email=$('#nuEmail').value.trim(), pw=$('#nuPw').value, negozio=$('#nuNeg').value.trim(), insegna=$('#nuIns').value.trim();
  if(!nome||!email||pw.length<6||!negozio){ $('#nuMsg').textContent='Compila nome, email, password (almeno 6 caratteri) e negozio.'; return; }
  try{
    const sec = firebase.apps.find(a=>a.name==='secondaria') || firebase.initializeApp(window.FIREBASE_CONFIG,'secondaria');
    const cred = await sec.auth().createUserWithEmailAndPassword(email, pw); const uid=cred.user.uid; await sec.auth().signOut();
    await Cloud.db.collection(COL.utenti).doc(uid).set({nome, email, negozio, insegna, ruolo:'venditore', attivo:true, creato:oggiISO()});
    $('#nuMsg').textContent='✅ Account creato. Comunica al venditore email e password provvisoria.'; renderAdmin();
  }catch(e){ $('#nuMsg').textContent='Errore: '+e.message; }
}
function righeExport(perNeg){
  return perNeg.map(r=>({Negozio:r.chiave, Insegna:r.insegna||'', 'Check-up':r.checkup||0, 'Convengono subito':r.subito||0, 'Con pacchetto':r.pacchetto||0, 'Non ora':r.nonora||0, Riepiloghi:r.riepilogo||0, Preventivi:r.preventivo||0, QR:r.qr||0, Promemoria:r.promemoria||0, Richiami:r.richiamo||0, 'Ultimo uso':r.ultimo?r.ultimo.toLocaleDateString('it-IT'):'mai'}));
}
async function esportaNegozi(perNeg, invia){
  if(!window.XLSX) await caricaScript('lib/xlsx.full.min.js');
  const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(righeExport(perNeg)); ws['!cols']=[{wch:24},{wch:16}].concat(Array(10).fill({wch:12}));
  XLSX.utils.book_append_sheet(wb, ws, 'Negozi');
  const nome=`TIM-Bollette-negozi-${ADM.giorni}gg-${oggiISO()}.xlsx`;
  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'}); const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  if(invia && await condividiFile(blob, nome, `Report TIM Bollette per negozio – ultimi ${ADM.giorni} giorni`)) return;
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=nome; a.click();
}
function classificaInsegne(){
  const lim=new Date(); lim.setDate(lim.getDate()-7);
  const ev=ADM.eventi.filter(e=>e.data>=lim && e.tipo==='checkup');
  const m={}; for(const e of ev){ const k=e.insegna||e.negozio||'—'; const r=m[k]=m[k]||{c:0,ok:0}; r.c++; if(e.dati&&(e.dati.esito==='subito'||e.dati.esito==='pacchetto')) r.ok++; }
  const cl=Object.entries(m).sort((a,b)=>b[1].c-a[1].c||b[1].ok-a[1].ok);
  const med=['🥇','🥈','🥉'];
  const t=['🏆 Classifica check-up bollette – ultimi 7 giorni', ...cl.map(([k,r],i)=>`${med[i]||(i+1)+'.'} ${k}: ${r.c} check-up${r.ok?` (${r.ok} convenienti)`:''}`), '', 'Forza ragazzi, ogni bolletta controllata è un cliente in più! 💪'].join('\n');
  window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank');
}

avviaCloud();
