const test=require('node:test');
const assert=require('node:assert/strict');
const v4=require('../server/v4-operating-system');

function state(){return {preferences:{timezone:'America/Detroit'},missions:[{id:'career',name:'CAREER',state:'ACTIVE',objective:'Find next job'},{id:'jarvis',name:'JARVIS',state:'ACTIVE BUILD',objective:'Build JARVIS'}],decisions:[],jobs:[],calendar:[],events:[]};}

test('contract preserves hard authority boundaries',()=>{
 assert.equal(v4.OPERATING_CONTRACT.boundaries.personal_messages,'OBSERVE_ONLY');
 assert.equal(v4.OPERATING_CONTRACT.boundaries.professional_messages,'PREPARE_ACTION_REQUIRES_APPROVAL');
 assert.equal(v4.OPERATING_CONTRACT.boundaries.money,'EXPLICIT_APPROVAL');
 assert.equal(v4.OPERATING_CONTRACT.boundaries.authority_changes,'EXPLICIT_APPROVAL');
 assert.equal(v4.OPERATING_CONTRACT.foundationalRulesMaySelfModify,false);
 assert.deepEqual(v4.OPERATING_CONTRACT.loop,['OBSERVE','UNDERSTAND','DISCOVER','PREPARE','RANK','ASK','EXECUTE','VERIFY','REMEMBER']);
});

test('JARVIS NOW produces a prepared decision with explanation',()=>{
 const s=state();
 const now=v4.jarvisNow(s);
 assert.ok(now.whatHappened);assert.ok(now.whyItMatters);assert.ok(now.recommendation);assert.ok(now.preparedDecision);
 assert.equal(now.recommendation.ref,'career');
});

test('pending human decision outranks background missions',()=>{
 const s=state();s.decisions.push({id:'d1',question:'Send recruiter reply?',status:'pending'});
 const now=v4.jarvisNow(s);
 assert.equal(now.recommendation.type,'decision');assert.equal(now.recommendation.ref,'d1');
});

test('morning meeting proposes a day instead of an empty questionnaire',()=>{
 const m=v4.morningMeeting(state(),{energy:'high',push:'attack'});
 assert.ok(m.proposedDay.length>=2);assert.ok(m.winCondition);assert.equal(m.energy,'high');
});

test('opportunity radar returns filtered possibilities',()=>{
 const r=v4.opportunityRadar(state(),{minutes:120});
 assert.equal(r.availableMinutes,120);assert.ok(r.possibilities.length>0);assert.ok(r.possibilities.length<=4);
});

test('daily checkout asks user to correct inferred reality',()=>{
 const s=state();s.events.push({id:'e1',summary:'Applied for job',result:'success',createdAt:new Date().toISOString()});
 const c=v4.dailyCheckout(s);assert.equal(c.inferred.length,1);assert.match(c.prompt,/Correct me/);
});

test('ensureV4 creates append-oriented black box state',()=>{
 const s=state();v4.ensureV4(s);assert.ok(Array.isArray(s.v4.blackBox));assert.equal(s.v4.fieldTest.status,'ACTIVE');
});
