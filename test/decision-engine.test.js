'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const policy=require('../server/action-policy');const decision=require('../server/decision-engine');
test('external communication remains human-approved',()=>{for(const actionType of ['send_email','send_message']){const r=policy.evaluate({actionType,confidence:.99,risk:'LOW',reversible:false,capability:'AVAILABLE',history:{approved:100}});assert.equal(r.mode,'ASK');assert.equal(r.guardrails.alwaysApproval,true);}});
test('high consequence commitments never automate',()=>{for(const actionType of ['transfer_money','purchase','medical_decision','legal_commitment','employment_commitment','accept_offer','decline_offer']){const r=policy.evaluate({actionType,confidence:1,risk:'LOW',reversible:true,capability:'AVAILABLE',history:{approved:1000}});assert.equal(r.mode,'ASK');assert.equal(r.guardrails.neverAutomate,true);}});
test('safe preparation can be prepared without side effects',()=>{const r=policy.evaluate({actionType:'summarize_context',confidence:.95,risk:'LOW',reversible:true,capability:'AVAILABLE'});assert.equal(r.mode,'PREPARE');});
test('learning adjustment is bounded',()=>{assert.ok(decision.learningAdjustment({observations:100,approved:100,edited:0,rejected:0})<=.12);assert.ok(decision.learningAdjustment({observations:100,approved:0,edited:0,rejected:100})>=-.12);});
