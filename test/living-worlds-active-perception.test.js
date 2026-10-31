const test=require('node:test');
const assert=require('node:assert/strict');
const google=require('../server/google');
const worlds=require('../server/world-engine');
test('active project perception exposes Gmail and Drive search hooks',()=>{
  assert.equal(typeof google.gmailSearch,'function');
  assert.equal(typeof google.driveSearch,'function');
  assert.equal(typeof worlds.activeHydrateProject,'function');
});
