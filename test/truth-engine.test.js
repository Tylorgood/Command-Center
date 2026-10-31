'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const truth=require('../server/truth-engine');

test('normalizes email deterministically',()=>{
  assert.equal(truth.normalizeEmail(' Tylor@Example.COM '),'tylor@example.com');
  assert.equal(truth.normalizeEmail('not-an-email'),null);
});

test('normalizes North American phone numbers',()=>{
  assert.equal(truth.normalizePhone('(586) 555-1212'),'+15865551212');
  assert.equal(truth.normalizePhone('+44 20 7946 0958'),'+442079460958');
  assert.equal(truth.normalizePhone('123'),null);
});

test('identity thresholds match brain update contract',()=>{
  assert.equal(truth.identityBand(.95),'AUTO_MERGE');
  assert.equal(truth.identityBand(.94),'LIKELY_MATCH');
  assert.equal(truth.identityBand(.75),'LIKELY_MATCH');
  assert.equal(truth.identityBand(.74),'POSSIBLE_MATCH');
  assert.equal(truth.identityBand(.40),'POSSIBLE_MATCH');
  assert.equal(truth.identityBand(.39),'KEEP_SEPARATE');
});

test('verified same phone is deterministic auto merge',()=>{
  const r=truth.scoreIdentity(
    {name:'Jason',identifiers:[{type:'phone',value:'586-555-1212',verified:true}]},
    {name:'J. Smith',identifiers:[{type:'phone',value:'+1 586 555 1212',verified:false}]}
  );
  assert.equal(r.band,'AUTO_MERGE');
  assert.ok(r.score>=.95);
  assert.ok(r.reasons.includes('phone_match'));
});

test('same name alone never auto merges',()=>{
  const r=truth.scoreIdentity({name:'Alex Smith',identifiers:[]},{name:'Alex Smith',identifiers:[]});
  assert.equal(r.band,'POSSIBLE_MATCH');
  assert.ok(r.score<.75);
});

test('same name plus organization remains reviewable',()=>{
  const r=truth.scoreIdentity({name:'Alex Smith',organization:'Acme'},{name:'Alex Smith',organization:'Acme'});
  assert.equal(r.band,'LIKELY_MATCH');
  assert.ok(r.score>=.75&&r.score<.95);
});

test('explicit contact association is deterministic',()=>{
  const r=truth.scoreIdentity({name:'Kelsey',contactBookMatch:true},{name:'Kelsey R.'});
  assert.equal(r.band,'AUTO_MERGE');
});

test('truth classes reject invented labels',()=>{
  assert.equal(truth.truthClass('SOURCE_VERIFIED'),'SOURCE_VERIFIED');
  assert.equal(truth.truthClass('definitely_true'),'UNKNOWN');
});

test('entity types separate people from services and unknowns',()=>{
  assert.equal(truth.entityType('person'),'PERSON');
  assert.equal(truth.entityType('service'),'SERVICE');
  assert.equal(truth.entityType('something_else'),'UNKNOWN_ENTITY');
});
