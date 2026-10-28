const token=document.getElementById('token');
const status=document.getElementById('status');
const pair=document.getElementById('pair');
const verify=document.getElementById('verify');

async function readJson(response){
  const text=await response.text();
  try{return text?JSON.parse(text):{}}catch{return {error:text||`HTTP ${response.status}`}}
}

pair.addEventListener('click',async()=>{
  pair.disabled=true;
  token.textContent='Creating…';
  try{
    const r=await fetch('/api/wearable/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({label:'Tylor Samsung · FitCloud'})});
    const j=await readJson(r);
    if(r.status===401){token.textContent='Sign in to JARVIS first, then reload this page.';return}
    if(!r.ok){token.textContent='Could not create code: '+(j.error||r.status);return}
    token.textContent=j.token||'Pairing code was not returned.';
  }catch(e){token.textContent='Connection error. Reload this page and try again.'}
  finally{pair.disabled=false}
});

verify.addEventListener('click',async()=>{
  verify.disabled=true;
  status.className='';
  status.textContent='Checking…';
  try{
    const r=await fetch('/api/wearable/status',{cache:'no-store'});
    const j=await readJson(r);
    if(r.status===401){status.textContent='Sign in to JARVIS first.';return}
    if(!r.ok){status.textContent='Could not check JARVIS: '+(j.error||r.status);return}
    if(j.connectionState==='CONNECTED'&&j.latest){
      const m=j.latest.metrics||{};
      status.className='ok';
      status.textContent='Connected · '+(m.steps??'—')+' steps · '+(m.heartRateBpm??'—')+' bpm · captured '+new Date(j.latest.captured_at).toLocaleString();
    }else{
      status.className='warn';
      status.textContent='Ready, but no wearable snapshot received yet.';
    }
  }catch(e){status.textContent='Connection error. Reload this page and try again.'}
  finally{verify.disabled=false}
});
