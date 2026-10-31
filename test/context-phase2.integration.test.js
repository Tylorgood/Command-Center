'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const truth=require('../server/truth-engine');
const ctx=require('../server/context-engine');

test('phase 2 postgres acceptance: cross-source conversations relationships time and context',async()=>{
  await truth.init(); await ctx.init();
  const stamp=Date.now(), email='phase2+'+stamp+'@example.com', phone='+1586'+String(stamp).slice(-7).padStart(7,'0');
  const person=await truth.createEntity({type:'PERSON',name:'Phase Two Test Person',canonical:'phase2-person-'+stamp,identifiers:[{type:'email',value:email,verified:true},{type:'phone',value:phone,verified:true}]});

  const g=await truth.observeMessage({source:'gmail',sourceRecordId:'g-'+stamp,threadId:'thread-'+stamp,senderEmail:email,senderName:'Phase Two Test Person',subject:'Project update',text:"Can you review this today? I'll follow up.",timestamp:new Date().toISOString()});
  const gc=await ctx.attachEvidence({evidenceId:g.evidence.id,threadId:'thread-'+stamp,senderEntityId:g.entity.id,direction:'INBOUND'});
  const gc2=await ctx.attachEvidence({evidenceId:g.evidence.id,threadId:'thread-'+stamp,senderEntityId:g.entity.id,direction:'INBOUND'});
  assert.equal(gc.id,gc2.id); assert.equal(gc2.message_count,1);

  const sms=await truth.observeMessage({source:'sms',sourceRecordId:'s-'+stamp,threadId:'sms-thread-'+stamp,senderPhone:phone,senderName:'Phase Two Test Person',text:'Waiting on approval. Keep me posted.',timestamp:new Date().toISOString()});
  assert.equal(sms.entity.id,person.id);
  await ctx.attachEvidence({evidenceId:sms.evidence.id,threadId:'sms-thread-'+stamp,senderEntityId:sms.entity.id,direction:'INBOUND'});

  const rel=await ctx.relationshipForEntity(person.id);
  assert.ok(rel); assert.equal(rel.interaction_count,2);

  const snap=await ctx.contextForEntity(person.id);
  assert.equal(snap.entity.id,person.id);
  assert.ok(snap.recentConversations.length>=2);
  assert.ok(snap.openCommitments.length>=3);
  assert.ok(snap.contextConfidence>=0&&snap.contextConfidence<=1);

  const oldEv=await truth.ingestEvidence({source:'test',sourceRecordId:'old-'+stamp,type:'record',content:{},ingestionMethod:'test'});
  const oldClaim=await truth.addClaim({subjectEntityId:person.id,claimKey:'role',value:'Programmer',truthClass:'SOURCE_VERIFIED',confidence:.9,evidenceIds:[oldEv.id]});
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});
  await pool.query("UPDATE jarvis_claims SET last_verified_at=now()-interval '365 days',last_observed_at=now()-interval '365 days' WHERE id=$1",[oldClaim.id]);
  const stale=await ctx.markStale({days:120}); assert.ok(stale.claimIds.includes(oldClaim.id));

  const ev2=await truth.ingestEvidence({source:'test',sourceRecordId:'new-'+stamp,type:'record',content:{},ingestionMethod:'test'});
  await truth.addClaim({subjectEntityId:person.id,claimKey:'employer',value:'Alpha',truthClass:'SOURCE_VERIFIED',confidence:.8,evidenceIds:[oldEv.id]});
  await truth.addClaim({subjectEntityId:person.id,claimKey:'employer',value:'Beta',truthClass:'SOURCE_VERIFIED',confidence:.8,evidenceIds:[ev2.id]});
  const contradictions=await ctx.detectContradictions(person.id);
  assert.ok(contradictions.some(x=>x.claim_key==='employer'));

  const sid='phase2-situation-'+stamp;
  await pool.query(`INSERT INTO jarvis_situations(id,canonical_key,title,domain,status,summary,recommended_action,priority,confidence,data)
    VALUES($1,$2,'Phase Two Context Situation','general','ACTIVE','context test','Review','MEDIUM',.9,'{}'::jsonb)`,[sid,'phase2-context-'+stamp]);
  await pool.query(`INSERT INTO jarvis_situation_links(id,situation_id,link_type,target_type,target_id,target_label,confidence,reason,evidence)
    VALUES($1,$2,'person','person',$3,'Phase Two Test Person',.99,'test','{}'::jsonb),
          ($4,$2,'project','project',$5,'Phase Two Project',.8,'test','{}'::jsonb)`,
    ['phase2-person-link-'+stamp,sid,person.id,'phase2-project-link-'+stamp,'project-'+stamp]);
  const graphBackfill=await ctx.backfillContextLinks({limit:100});
  assert.ok(graphBackfill.entities>=1);
  const hydrated=await ctx.contextForEntity(person.id);
  assert.ok(hydrated.links.some(x=>x.to_type==='SITUATION'));
  assert.ok(hydrated.links.some(x=>x.to_type==='PROJECT'));

  const search=await ctx.searchContext('Phase Two Test Person');
  assert.ok(search.some(x=>x.id===person.id));

  const status=await ctx.phaseTwoStatus();
  assert.equal(status.status,'READY'); assert.equal(status.security.rlsEnabled,true); assert.equal(status.security.protectedTables,6);
  await pool.end();
});
