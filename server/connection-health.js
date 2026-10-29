const google=require('./google');
const capabilities=require('./capabilities');
const {iso}=require('./store');
const STATES={NOT_CONNECTED:'NOT_CONNECTED',CONNECTING:'CONNECTING',VERIFYING:'VERIFYING',HEALTHY:'HEALTHY',AUTH_REQUIRED:'AUTH_REQUIRED',STALE:'STALE',DEGRADED:'DEGRADED',ERROR:'ERROR'};
function normalize(status,lastSuccessAt){const s=String(status||'').toUpperCase();if(s==='CONNECTED')return STATES.HEALTHY;if(s==='AUTH_REQUIRED')return STATES.AUTH_REQUIRED;if(s==='ERROR')return STATES.ERROR;if(s==='CONNECTING')return STATES.CONNECTING;if(s==='VERIFYING')return STATES.VERIFYING;if(s==='STALE')return STATES.STALE;if(s==='DEGRADED')return STATES.DEGRADED;if(lastSuccessAt)return STATES.STALE;return STATES.NOT_CONNECTED;}
function ageMs(value){const t=Date.parse(value||'');return Number.isFinite(t)?Date.now()-t:Infinity;}
function connector(name,raw={},extra={}){let status=normalize(raw.status,raw.lastSuccessAt);if(status===STATES.HEALTHY&&ageMs(raw.lastSuccessAt)>15*60*1000)status=STATES.STALE;return{name,status,verified:status===STATES.HEALTHY,lastCheckedAt:raw.lastCheckedAt||null,lastSuccessAt:raw.lastSuccessAt||null,lastError:raw.lastError||null,details:raw.details||null,...extra};}
async function snapshot(state={}){const now=iso(),ints=state.integrations||{};let caps={};try{caps=await capabilities.current()}catch{}
let gs={};try{gs=await google.status()}catch(e){gs={configured:false,authorized:false,error:e.message}}
const items={
 gmail:connector('Gmail',ints.gmail,{family:'google',configured:Boolean(gs.configured),authorized:Boolean(gs.authorized),capabilities:caps.gmail||{}}),
 drive:connector('Drive',ints.drive,{family:'google',configured:Boolean(gs.configured),authorized:Boolean(gs.authorized),capabilities:caps.drive||{}}),
 calendar:connector('Calendar',ints.calendar,{family:'google',configured:Boolean(gs.configured),authorized:Boolean(gs.authorized),capabilities:caps.calendar||{}}),
 github:{name:'GitHub',family:'system',status:process.env.GITHUB_TOKEN?STATES.VERIFYING:STATES.NOT_CONNECTED,verified:false,configured:Boolean(process.env.GITHUB_TOKEN),lastCheckedAt:now,details:process.env.GITHUB_TOKEN?'Configured; runtime verification required.':'No server credential configured.'},
 render:{name:'Render',family:'system',status:process.env.RENDER?STATES.HEALTHY:STATES.VERIFYING,verified:Boolean(process.env.RENDER),configured:true,lastCheckedAt:now,details:process.env.RENDER?'Render runtime detected.':'Runtime deployment verification pending.'},
 memory:{name:'Memory',family:'system',status:process.env.DATABASE_URL?STATES.HEALTHY:STATES.ERROR,verified:Boolean(process.env.DATABASE_URL),configured:Boolean(process.env.DATABASE_URL),lastCheckedAt:now,details:process.env.DATABASE_URL?'Database configured for persistent state.':'DATABASE_URL missing.'},
 sms:{name:'SMS',family:'communications',status:STATES.NOT_CONNECTED,verified:false,configured:false,lastCheckedAt:now,details:'SMS provider bridge not configured.'},
 health:{name:'Health',family:'health',status:STATES.NOT_CONNECTED,verified:false,configured:false,lastCheckedAt:now,details:'Health source is not connected to the web cockpit.'}
};
const values=Object.values(items),required=[items.gmail,items.drive,items.calendar,items.memory];const overall=required.some(x=>x.status===STATES.ERROR)?STATES.ERROR:required.some(x=>[STATES.AUTH_REQUIRED,STATES.NOT_CONNECTED].includes(x.status))?STATES.AUTH_REQUIRED:required.some(x=>[STATES.STALE,STATES.DEGRADED,STATES.VERIFYING].includes(x.status))?STATES.DEGRADED:STATES.HEALTHY;
return{generatedAt:now,overall,states:STATES,google:{configured:Boolean(gs.configured),authorized:Boolean(gs.authorized),redirectUri:google.redirectUri(),requestedScopes:google.requestedScopes||[],connectUrl:'/api/google/start'},connectors:items,summary:{healthy:values.filter(x=>x.status===STATES.HEALTHY).length,attention:values.filter(x=>x.status!==STATES.HEALTHY).length,total:values.length}};}
module.exports={STATES,normalize,snapshot};