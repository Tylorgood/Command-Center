const test=require('node:test');
const assert=require('node:assert/strict');
const router=require('../server/world-engine');
const project=(name,canonical)=>({name,data:canonical?{canonical}:{}});
test('project routing uses distinctive identity',()=>{
  assert.equal(router.routeScore('newsletter roundup',project('Manufacturing AI Capability / Sales')),0);
  assert.equal(router.routeScore('vendor receipt',project('Manufacturing AI Capability / Sales')),0);
  assert.ok(router.routeScore('Manufacturing AI capability sheet for shops',project('Manufacturing AI Capability / Sales'))>0);
  assert.equal(router.routeScore('code build failed in CI',project('G-code Game')),0);
  assert.ok(router.routeScore('G-code Game learner acceptance test',project('G-code Game'))>0);
  assert.equal(router.routeScore('brain status is healthy',project('Quantumatic / Company Brain')),0);
  assert.ok(router.routeScore('Quantumatic architecture update',project('Quantumatic / Company Brain'))>0);
  assert.ok(router.routeScore('freecnc landing workflow failed',project('FREECNC','freecnc'))>0);
});
