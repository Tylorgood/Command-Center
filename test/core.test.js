const assert=require('assert');
process.env.JARVIS_STATE_FILE=`/tmp/jarvis-test-${Date.now()}.json`;
const engine=require('../server/engine');
(async()=>{
  let s=await engine.publicState();assert(s.now);assert(Array.isArray(s.missions));
  const d=await engine.createDecision({missionId:'jarvis',question:'Test decision?',options:['yes','no']});
  const j=await engine.createJob({missionId:'jarvis',title:'Blocked test job',action:'test',status:'waiting_for_user',decisionId:d.id,blocker:'decision'});
  const out=await engine.resolveDecision(d.id,'yes');assert(out.releasedJobs.includes(j.id));
  s=await engine.publicState();const released=s.active.find(x=>x.id===j.id);assert(released&&released.status==='queued');
  await engine.updateJob(j.id,{status:'running'});await engine.updateJob(j.id,{status:'completed',result:'ok'});
  await engine.syncCalendar([{id:'x',title:'Test event',start:new Date(Date.now()+3600000).toISOString()}]);
  s=await engine.publicState();assert.equal(s.calendar.length,1);assert(s.events.some(e=>e.type==='calendar_sync'));assert(s.events.some(e=>e.type==='decision'));assert(s.now.nextCommitment);
  console.log('core tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
