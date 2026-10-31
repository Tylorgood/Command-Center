'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ctx=require('../server/context-engine');

test('conversation signals detect questions decisions urgency and commitments',()=>{
  const s=ctx.conversationSignals("Can you send it today? I'll follow up. We agreed.");
  assert.equal(s.question,true);
  assert.equal(s.decision,true);
  assert.equal(s.urgency,true);
  assert.ok(s.commitmentTypes.includes('REQUEST'));
  assert.ok(s.commitmentTypes.includes('PROMISE'));
  assert.ok(s.commitmentTypes.includes('DEADLINE'));
  assert.ok(s.commitmentTypes.includes('FOLLOW_UP'));
});

test('commitment signals keep waiting state explicit',()=>{
  const s=ctx.commitmentSignals('We are waiting on the customer and will keep you posted.');
  assert.ok(s.includes('WAITING'));
  assert.ok(s.includes('FOLLOW_UP'));
});

test('context tokenization removes filler while preserving identifiers',()=>{
  const t=ctx.tokens('Update from Jason jason@example.com about the CNC project');
  assert.ok(t.includes('jason@example.com'));
  assert.ok(t.includes('cnc'));
  assert.ok(!t.includes('the'));
});
