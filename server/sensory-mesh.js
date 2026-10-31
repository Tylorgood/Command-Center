'use strict';
const crypto=require('crypto');
const {Pool}=require('pg');
let pool;
function db(){if(!pool)pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});return pool}
function hash(v){return crypto.createHash('sha256').update(JSON.stringify(v??null)).digest('hex')}
function freshness(ts,ttl=180){if(!ts)return'UNKNOWN';const age=Date.now()-Date.parse(ts);return Number.isFinite(age)&&age>=0&&age<=ttl*60000?'LIVE':'STALE'}
function envelope(source,payload={},meta={}){const now=new Date().toISOString(),observedAt=meta.observedAt||payload.observedAt||payload.verifiedAt||now;return{supplier:source,connectionState:meta.connectionState||'CONNECTED',observedAt,receivedAt:now,cursor:meta.cursor||observedAt,eventId:meta.eventId||source+':'+hash(payload).slice(0,20),eventType:meta.eventType||'SNAPSHOT',payloadHash:hash(payload),freshness:meta.freshness||freshness(observedAt,meta.ttlMinutes||180),confidence:meta.confidence??1,provenance:meta.provenance||{},payload}}
module.exports={db,hash,freshness,envelope};