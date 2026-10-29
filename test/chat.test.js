'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {deterministic}=require('../server/chat');
const ctx={mail:{gmail:[{source:'gmail',from:'Recruiter',subject:'Interview',unread:true,receivedAt:'2026-10-29T12:00:00Z'}],yahoo:[{source:'yahoo',from:'Shop',subject:'Quote ready',unread:true,receivedAt:'2026-10-29T13:00:00Z'}],yahooConnection:{state:'HEALTHY',verified:true}},attention:{items:[{title:'Reply to recruiter',recommendedAction:'Review and respond'}]},next24:{items:[{title:'Call',start:'2026-10-29T15:00:00Z'}]},projects:{items:[{name:'JARVIS',momentum:'MOVING'}]},health:{connectionStatus:'CONNECTED',readings:{steps:1234}}};
test('Yahoo question uses Yahoo source',()=>{const x=deterministic('what is in yahoo?',ctx);assert.match(x,/Yahoo is connected/);assert.match(x,/Quote ready/)});
test('overview combines cockpit sources',()=>{const x=deterministic('catch me up on what is going on',ctx);assert.match(x,/1 attention item/);assert.match(x,/2 unread email signals/)});
test('mail question labels both providers',()=>{const x=deterministic('show my messages',ctx);assert.match(x,/\[YAHOO\]/);assert.match(x,/\[GMAIL\]/)});
