const assert=require('assert');
const {spawn}=require('child_process');
const port=18765;
const stateFile=`/tmp/jarvis-http-${Date.now()}.json`;
let stdout='',stderr='',exitInfo=null;
const child=spawn(process.execPath,['server.js'],{
  cwd:process.cwd(),
  env:{...process.env,PORT:String(port),JARVIS_ACCESS_KEY:'test-key',JARVIS_SESSION_SECRET:'test-secret',JARVIS_STATE_FILE:stateFile,JARVIS_TEST_MODE:'1'},
  stdio:['ignore','pipe','pipe']
});
child.stdout.on('data',d=>{const s=String(d);stdout+=s;process.stdout.write(`[server] ${s}`)});
child.stderr.on('data',d=>{const s=String(d);stderr+=s;process.stderr.write(`[server:error] ${s}`)});
child.on('exit',(code,signal)=>{exitInfo={code,signal}});
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function req(path,opts={}){return fetch(`http://127.0.0.1:${port}${path}`,opts)}
async function waitReady(){
  let last;
  for(let i=0;i<120;i++){
    if(exitInfo)throw new Error(`server exited before readiness: ${JSON.stringify(exitInfo)}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    try{const r=await req('/api/health');if(r.status===200)return}catch(e){last=e}
    await sleep(250);
  }
  throw new Error(`server readiness timeout; last=${last?.message||'unknown'}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
}
(async()=>{
  await waitReady();
  let r=await req('/api/health');assert.equal(r.status,200);
  r=await req('/api/state');assert.equal(r.status,401);
  r=await req('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'wrong'})});assert.equal(r.status,401);
  r=await req('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'test-key'})});assert.equal(r.status,200);
  const cookie=r.headers.get('set-cookie').split(';')[0];const h={'content-type':'application/json','cookie':cookie};
  r=await req('/api/state',{headers:h});assert.equal(r.status,200);let s=await r.json();assert(s.missions.length>=5);
  r=await req('/api/decisions',{method:'POST',headers:h,body:JSON.stringify({missionId:'jarvis',question:'Ship test?',options:['yes','no']})});const d=await r.json();assert.equal(r.status,201);
  r=await req('/api/jobs',{method:'POST',headers:h,body:JSON.stringify({missionId:'jarvis',title:'Ship test build',action:'deploy',status:'waiting_for_user',decisionId:d.id,blocker:'decision'})});const j=await r.json();assert.equal(r.status,201);
  r=await req(`/api/decisions/${d.id}/resolve`,{method:'POST',headers:h,body:JSON.stringify({option:'yes'})});const out=await r.json();assert(out.releasedJobs.includes(j.id));
  r=await req('/api/state',{headers:h});s=await r.json();assert(s.active.some(x=>x.id===j.id&&x.status==='queued'));assert(s.events.some(x=>x.type==='decision'));
  console.log('http tests passed');child.kill('SIGTERM');
})().catch(e=>{console.error(e);child.kill('SIGTERM');process.exit(1)});
