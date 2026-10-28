const token=document.getElementById('token');
const status=document.getElementById('status');
const pair=document.getElementById('pair');
const verify=document.getElementById('verify');
const copy=document.getElementById('copy');
let pairingToken='';

async function readJson(response){const text=await response.text();try{return text?JSON.parse(text):{}}catch{return {error:text||`HTTP ${response.status}`}}}

pair.addEventListener('click',async()=>{
  pair.disabled=true; token.textContent='Creating…'; copy.classList.add('hidden');
  try{
    const r=await fetch('/api/wearable/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({label:'Samsung · JARVIS Companion'})});
    const j=await readJson(r);
    if(r.status===401){token.textContent='Sign in to JARVIS first, then return to this page.';return}
    if(!r.ok){token.textContent='Could not create code: '+(j.error||r.status);return}
    pairingToken=j.token||''; token.textContent=pairingToken||'Pairing code was not returned.';
    if(pairingToken) copy.classList.remove('hidden');
  }catch(e){token.textContent='Connection error. Reload this page and try again.'}
  finally{pair.disabled=false}
});

copy.addEventListener('click',async()=>{
  if(!pairingToken)return;
  try{await navigator.clipboard.writeText(pairingToken);copy.textContent='Copied ✓'}catch{token.focus?.();copy.textContent='Press and hold the code to copy'}
  setTimeout(()=>copy.textContent='Copy Code',1800);
});

verify.addEventListener('click',async()=>{
  verify.disabled=true; status.className=''; status.textContent='Checking…';
  try{
    const r=await fetch('/api/wearable/status',{cache:'no-store'}); const j=await readJson(r);
    if(r.status===401){status.textContent='Sign in to JARVIS first.';return}
    if(!r.ok){status.textContent='Could not check JARVIS: '+(j.error||r.status);return}
    if(j.connectionState==='CONNECTED'&&j.latest){
      const m=j.latest.metrics||{}; status.className='ok';
      const bits=[m.steps!=null?`${m.steps} steps`:null,m.heartRateBpm!=null?`${m.heartRateBpm} bpm`:null,m.sleepMinutes!=null?`${m.sleepMinutes} min sleep`:null].filter(Boolean);
      status.textContent='CONNECTED · '+(bits.join(' · ')||'snapshot received')+' · '+new Date(j.latest.captured_at).toLocaleString();
    }else{status.className='warn';status.textContent='JARVIS is ready, but this phone has not sent a wearable snapshot yet.'}
  }catch(e){status.textContent='Connection error. Reload this page and try again.'}
  finally{verify.disabled=false}
});
