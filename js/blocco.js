/* TIM Bollette – blocco dell'app con PIN e impronta/volto, Richiami con impronta */
"use strict";

/* ---------- impostazioni ---------- */
function cfgBlocco(){ try{ return Object.assign({attivo:false, minuti:15, pinHash:'', credId:''}, JSON.parse(localStorage.getItem('bloccoApp')||'{}')); }catch(e){ return {attivo:false, minuti:15, pinHash:'', credId:''}; } }
function salvaCfgBlocco(c){ try{ localStorage.setItem('bloccoApp', JSON.stringify(c)); }catch(e){} }
async function bioDisponibile(){ try{ return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }catch(e){ return false; } }
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
async function creaCredenziale(nome){
  return navigator.credentials.create({publicKey:{
    challenge:rnd(32), rp:{name:'TIM Bollette'}, user:{id:rnd(16), name:nome, displayName:nome},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{authenticatorAttachment:'platform', userVerification:'required', residentKey:'discouraged'},
    timeout:60000, extensions:{prf:{}} }});
}
async function verificaBio(credId, salt){
  const pk={challenge:rnd(32), allowCredentials:[{type:'public-key', id:unb64(credId)}], userVerification:'required', timeout:60000};
  if(salt) pk.extensions={prf:{eval:{first:unb64(salt)}}};
  return navigator.credentials.get({publicKey:pk});
}

/* ---------- schermata di blocco ---------- */
let SBLOCCATA = true;
let ultimaScrittura = 0;
function segnaAttivita(forza){ const ora=Date.now(); if(forza || ora-ultimaScrittura>20000){ ultimaScrittura=ora; try{ localStorage.setItem('ultimaAttivita', String(ora)); }catch(e){} } }
function scaduta(){ const c=cfgBlocco(); const ult=+(localStorage.getItem('ultimaAttivita')||0); return Date.now()-ult > (c.minuti||15)*60000; }
function sblocca(){ SBLOCCATA=true; $('#schermoBlocco').classList.remove('on'); segnaAttivita(true); }
function mostraBlocco(){
  const c=cfgBlocco(); if(!c.attivo || !c.pinHash) return;
  SBLOCCATA=false; const el=$('#schermoBlocco');
  el.innerHTML=`<div class="bbox"><div style="font-size:40px">🔒</div><h2 style="color:var(--blu);margin:6px 0 14px">TIM Bollette</h2>
    ${c.credId?'<button class="btn verde" id="bBio" style="width:100%">👆 Sblocca con impronta o volto</button><p class="small" style="margin:12px 0 0">oppure con il PIN</p>':'<p class="small" style="margin:0">Inserisci il PIN</p>'}
    <input id="bPin" type="password" inputmode="numeric" autocomplete="off">
    <div class="azioni" style="justify-content:center"><button class="btn" id="bOk">Sblocca</button></div><p class="small" id="bErr" style="color:var(--rosso)"></p></div>`;
  el.classList.add('on');
  $('#bOk').onclick=async()=>{ if(await hashPin($('#bPin').value)===c.pinHash) sblocca(); else { $('#bErr').textContent='PIN errato'; $('#bPin').value=''; } };
  $('#bPin').onkeydown=e=>{ if(e.key==='Enter') $('#bOk').click(); };
  if($('#bBio')) $('#bBio').onclick=async()=>{ try{ await verificaBio(c.credId); sblocca(); }catch(e){ $('#bErr').textContent='Impronta non riconosciuta: usa il PIN.'; } };
}
['click','keydown','touchstart','scroll'].forEach(ev=>document.addEventListener(ev, ()=>{ if(SBLOCCATA) segnaAttivita(); }, {passive:true, capture:true}));
document.addEventListener('visibilitychange', ()=>{ if(document.hidden){ if(SBLOCCATA) segnaAttivita(true); } else if(cfgBlocco().attivo && SBLOCCATA && scaduta()) mostraBlocco(); });
setInterval(()=>{ if(cfgBlocco().attivo && SBLOCCATA && scaduta()) mostraBlocco(); }, 30000);

/* ---------- impostazioni del blocco (tasto 🔒 in alto) ---------- */
async function apriImpostazioniBlocco(){
  const c=cfgBlocco(); const bio=await bioDisponibile(); const rb=richiamiBio();
  apriModale(`<h2>🔒 Blocco dell'app</h2>
    <p class="small" style="margin-top:0">Quando l'app resta inutilizzata per il tempo scelto, alla riapertura chiede il PIN${bio?' o l\'impronta (o il riconoscimento del volto)':''}. Vale solo su questo dispositivo.</p>
    <div class="toggle"><span class="q"><b>Blocco attivo</b></span><span class="seg" id="blAttivo"><button data-v="1" class="${c.attivo?'on':''}">Sì</button><button data-v="0" class="${c.attivo?'':'on'}">No</button></span></div>
    <div class="toggle"><span class="q">PIN ${c.pinHash?'<span class="chip ok">impostato</span>':'<span class="chip wa">da impostare</span>'}</span><button class="btn sec picc" id="blPin">${c.pinHash?'Cambia PIN':'Imposta PIN'}</button></div>
    <div class="toggle"><span class="q">Impronta / volto ${c.credId?'<span class="chip ok">attiva</span>':''}</span>${bio?`<button class="btn sec picc" id="blBio">${c.credId?'Disattiva':'Attiva'}</button>`:'<span class="small">non disponibile su questo dispositivo</span>'}</div>
    <div class="toggle"><span class="q">Chiedi lo sblocco dopo</span><select id="blMin" style="padding:6px;border-radius:8px;border:1px solid var(--linea)">${[5,15,30,60,240].map(m=>`<option value="${m}" ${c.minuti===m?'selected':''}>${m<60?m+' minuti':(m/60)+(m===60?' ora':' ore')} di inattività</option>`).join('')}</select></div>
    <div class="toggle"><span class="q">Richiami con l'impronta ${rb?'<span class="chip ok">attivo</span>':''}</span><span class="small">${rb?'<a href="#" id="blRbOff">disattiva</a>':'si attiva aprendo i Richiami con la password'}</span></div>
    <p class="small" id="blMsg" style="color:var(--rosso)"></p>
    <div class="azioni"><button class="btn" data-chiudi>Fatto</button></div>`);
  $('#blMin').onchange=e=>{ const x=cfgBlocco(); x.minuti=+e.target.value; salvaCfgBlocco(x); };
  $('#blAttivo').onclick=e=>{ const b=e.target.closest('button'); if(!b) return; const x=cfgBlocco();
    if(b.dataset.v==='1' && !x.pinHash){ $('#blMsg').textContent='Prima imposta il PIN.'; return; }
    x.attivo = b.dataset.v==='1'; salvaCfgBlocco(x); segnaAttivita(true); apriImpostazioniBlocco(); };
  $('#blPin').onclick=()=>{
    apriModale(`<h2>PIN di sblocco</h2><label class="c">Nuovo PIN (4-8 cifre)<input id="np1" type="password" inputmode="numeric"></label><label class="c" style="margin-top:8px">Ripeti il PIN<input id="np2" type="password" inputmode="numeric"></label>
      <div class="azioni"><button class="btn" id="npOk">Salva</button><button class="btn sec" id="npNo">Annulla</button></div><p class="small" id="npMsg" style="color:var(--rosso)"></p>`);
    $('#npNo').onclick=apriImpostazioniBlocco;
    $('#npOk').onclick=async()=>{ const a=$('#np1').value, b=$('#np2').value; if(!/^\d{4,8}$/.test(a)){ $('#npMsg').textContent='Usa da 4 a 8 cifre'; return; } if(a!==b){ $('#npMsg').textContent='I due PIN non coincidono'; return; }
      const x=cfgBlocco(); x.pinHash=await hashPin(a); x.attivo=true; salvaCfgBlocco(x); segnaAttivita(true); apriImpostazioniBlocco(); };
  };
  if($('#blBio')) $('#blBio').onclick=async()=>{ const x=cfgBlocco();
    if(x.credId){ x.credId=''; salvaCfgBlocco(x); apriImpostazioniBlocco(); return; }
    if(!x.pinHash){ $('#blMsg').textContent='Prima imposta il PIN (serve se l\'impronta non viene letta).'; return; }
    try{ const cr=await creaCredenziale('TIM Bollette'); x.credId=b64(new Uint8Array(cr.rawId)); salvaCfgBlocco(x); apriImpostazioniBlocco(); }
    catch(e){ $('#blMsg').textContent='Impronta non attivata: '+(e.name==='NotAllowedError'?'operazione annullata':e.message); } };
  if($('#blRbOff')) $('#blRbOff').onclick=ev=>{ ev.preventDefault(); try{ localStorage.removeItem('richiamiBio'); }catch(e){} apriImpostazioniBlocco(); };
}
$('#btnBlocco').onclick=apriImpostazioniBlocco;

/* ---------- Richiami con l'impronta (chiave derivata dall'impronta, solo dove il telefono lo supporta) ---------- */
function richiamiBio(){ try{ return JSON.parse(localStorage.getItem('richiamiBio')||'null'); }catch(e){ return null; } }
async function chiaveDaPrf(asr){ const r=asr.getClientExtensionResults && asr.getClientExtensionResults(); const out=r&&r.prf&&r.prf.results&&r.prf.results.first; if(!out) return null; return crypto.subtle.importKey('raw', out, 'AES-GCM', false, ['encrypt','decrypt']); }
async function offriBioRichiami(pw){
  if(richiamiBio() || !(await bioDisponibile())) return;
  try{ if(localStorage.getItem('richiamiBioNo')) return; }catch(e){}
  const box=$('#richiamiBox'); const d=document.createElement('div');
  d.className='avviso blu'; d.innerHTML=`👆 Vuoi aprire i Richiami con l'impronta (o il volto) invece della password? <div class="azioni"><button class="btn picc" id="rbSi">Sì, attiva</button><button class="btn sec picc" id="rbNo">No, grazie</button></div><p class="small" id="rbMsg"></p>`;
  box.prepend(d);
  $('#rbNo').onclick=()=>{ try{ localStorage.setItem('richiamiBioNo','1'); }catch(e){} d.remove(); };
  $('#rbSi').onclick=async()=>{
    try{
      const cr=await creaCredenziale('Richiami TIM Bollette'); const credId=b64(new Uint8Array(cr.rawId));
      const ext=cr.getClientExtensionResults ? cr.getClientExtensionResults() : {};
      if(!(ext.prf && ext.prf.enabled)){ $('#rbMsg').textContent='Questo telefono non permette di usare l\'impronta per aprire dati cifrati: continua con la password.'; return; }
      const salt=b64(rnd(32)); const as=await verificaBio(credId, salt); const k=await chiaveDaPrf(as);
      if(!k){ $('#rbMsg').textContent='Questo telefono non permette di usare l\'impronta per aprire dati cifrati: continua con la password.'; return; }
      const iv=rnd(12); const enc=await crypto.subtle.encrypt({name:'AES-GCM', iv}, k, new TextEncoder().encode(pw));
      localStorage.setItem('richiamiBio', JSON.stringify({credId, salt, iv:b64(iv), enc:b64(new Uint8Array(enc))}));
      d.innerHTML='✅ Fatto: la prossima volta apri i Richiami con l\'impronta. La password resta valida.';
    }catch(e){ $('#rbMsg').textContent='Impronta non attivata: '+(e.name==='NotAllowedError'?'operazione annullata':e.message); }
  };
}
function bioRichiamiUI(){
  const rb=richiamiBio(); const el=$('#rBio'); if(!rb || !el) return;
  el.innerHTML='<div class="azioni" style="justify-content:center;margin-top:0"><button class="btn verde" id="rApriBio">👆 Apri con l\'impronta</button></div>';
  $('#rApriBio').onclick=async()=>{
    try{ const as=await verificaBio(rb.credId, rb.salt); const k=await chiaveDaPrf(as); if(!k) throw new Error('impronta non utilizzabile');
      const pw=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM', iv:unb64(rb.iv)}, k, unb64(rb.enc)));
      if(await sbloccaRichiami(pw)) renderRichiami(); else $('#rMsg').textContent='Usa la password.';
    }catch(e){ $('#rMsg').textContent='Impronta non riconosciuta: usa la password.'; }
  };
}

/* ---------- avvio: se il blocco è attivo e il tempo è scaduto, chiede lo sblocco ---------- */
(function(){ const c=cfgBlocco(); if(c.attivo && c.pinHash && scaduta()) mostraBlocco(); else segnaAttivita(true); })();
