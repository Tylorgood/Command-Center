'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const truth=require('../server/truth-engine');

test('phase 1 postgres integration: evidence identity provenance and correction',async()=>{
  await truth.init();

  const stamp=Date.now();
  const person=await truth.createEntity({
    type:'PERSON',name:'Phase One Test Person',canonical:'phase1-person-'+stamp,contactBookMatch:true,
    identifiers:[
      {type:'email',value:'phase1+'+stamp+'@example.com',verified:true},
      {type:'phone',value:'+1586555'+String(stamp).slice(-4).padStart(4,'0'),verified:true}
    ]
  });

  const gmail=await truth.observeMessage({
    source:'gmail',sourceRecordId:'gmail-'+stamp,senderEmail:'phase1+'+stamp+'@example.com',
    senderName:'Phase One Test Person',subject:'hello',timestamp:new Date().toISOString()
  });
  const yahoo=await truth.observeMessage({
    source:'yahoo',sourceRecordId:'yahoo-'+stamp,senderEmail:'phase1+'+stamp+'@example.com',
    senderName:'Phase One Test Person',subject:'hello again',timestamp:new Date().toISOString()
  });
  const sms=await truth.observeMessage({
    source:'sms',sourceRecordId:'sms-'+stamp,senderPhone:'+1586555'+String(stamp).slice(-4).padStart(4,'0'),
    senderName:'Phase One Test Person',text:'text message',timestamp:new Date().toISOString()
  });
  assert.equal(gmail.entity.id,person.id);
  assert.equal(yahoo.entity.id,person.id);
  assert.equal(sms.entity.id,person.id);

  const ev1=await truth.ingestEvidence({source:'sms',sourceRecordId:'immutable-'+stamp,type:'message',content:{text:'original'},ingestionMethod:'test'});
  const ev2=await truth.ingestEvidence({source:'sms',sourceRecordId:'immutable-'+stamp,type:'message',content:{text:'changed'},ingestionMethod:'test'});
  assert.equal(ev1.id,ev2.id);
  assert.deepEqual(ev2.content,{text:'original'});

  const unknown=await truth.observeMessage({
    source:'sms',sourceRecordId:'unknown-'+stamp,senderPhone:'+1313555'+String(stamp).slice(-4).padStart(4,'0'),
    text:'one-off',timestamp:new Date().toISOString()
  });
  assert.equal(unknown.entity.data.entityClass,'UNKNOWN_ENTITY');

  const automated=await truth.observeMessage({
    source:'sms',sourceRecordId:'bulk-'+stamp,senderPhone:'+1248555'+String(stamp).slice(-4).padStart(4,'0'),
    senderName:'Alerts',text:'campaign',bulk:true,timestamp:new Date().toISOString()
  });
  assert.equal(automated.entity.data.entityClass,'SERVICE');

  const evidence=await truth.ingestEvidence({source:'contacts',sourceRecordId:'contact-'+stamp,type:'contact',content:{name:'Phase One Test Person'},ingestionMethod:'test'});
  const claim=await truth.addClaim({subjectEntityId:person.id,claimKey:'employer',value:'Acme',truthClass:'SOURCE_VERIFIED',confidence:.98,evidenceIds:[evidence.id]});
  assert.equal(claim.truth_class,'SOURCE_VERIFIED');
  assert.equal(claim.evidence.length,1);

  const corrected=await truth.correctClaim({claimId:claim.id,value:'NewCo'});
  assert.equal(corrected.truth_class,'USER_CONFIRMED');
  assert.equal(corrected.supersedes_claim_id,claim.id);

  const old=await truth.claimById(claim.id);
  assert.equal(old.status,'SUPERSEDED');

  const status=await truth.phaseOneStatus();
  assert.equal(status.status,'READY');
  assert.ok(status.counts.jarvis_evidence>=6);
});
