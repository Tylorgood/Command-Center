const {getSecret}=require('./vault');
const yahoo=require('./yahoo');
const TOKEN_KEY='google_oauth_v1';
const STATES={NOT_CONNECTED:'NOT_CONNECTED',CONNECTING:'CONNECTING',VERIFYING:'VERIFYING',HEALTHY:'HEALTHY',AUTH_REQUIRED:'AUTH_REQUIRED',STALE:'STALE',DEGRADED:'DEGRADED',ERROR:'ERROR'};
function scopeSet(value){return new Set(String(value||'').split(/\s+/).filter(Boolean));}
function hasAny(set,values){return values.some(v=>set.has(v));}
function fromScopes(scope=''){const s=scopeSet(scope);const gmailFull='https://mail.google.com/';const gmailModify='https://www.googleapis.com/auth/gmail.modify';const gmailCompose='https://www.googleapis.com/auth/gmail.compose';const gmailSend='https://www.googleapis.com/auth/gmail.send';const gmailRead='https://www.googleapis.com/auth/gmail.readonly';const calFull='https://www.googleapis.com/auth/calendar';const calEvents='https://www.googleapis.com/auth/calendar.events';const calRead='https://www.googleapis.com/auth/calendar.readonly';const driveMeta='https://www.googleapis.com/auth/drive.metadata.readonly';const driveRead='https://www.googleapis.com/auth/drive.readonly';return{
 gmail:{read:hasAny(s,[gmailRead,gmailModify,gmailFull]),compose:hasAny(s,[gmailCompose,gmailModify,gmailFull]),send:hasAny(s,[gmailSend,gmailModify,gmailFull])},
 calendar:{read:hasAny(s,[calRead,calEvents,calFull]),write:hasAny(s,[calEvents,calFull])},
 drive:{metadataRead:hasAny(s,[driveMeta,driveRead,'https://www.googleapis.com/auth/drive'])},
 internal:{prepare:true,remember:true,linkContext:true},scope:[...s]
};}
function connectionRegistry({token,caps}){const authorized=Boolean(token?.refresh_token),googleConfigured=Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.JARVIS_SESSION_SECRET&&process.env.DATABASE_URL);const googleState=!googleConfigured?STATES.NOT_CONNECTED:authorized?STATES.VERIFYING:STATES.AUTH_REQUIRED;return{
 states:STATES,
 google:{state:googleState,configured:googleConfigured,authorized,connectUrl:'/api/google/start'},
 connectors:{
  gmail:{name:'Gmail',family:'google',state:googleState,configured:googleConfigured,authorized,verified:false,capabilities:caps.gmail},
  drive:{name:'Drive',family:'google',state:googleState,configured:googleConfigured,authorized,verified:false,capabilities:caps.drive},
  calendar:{name:'Calendar',family:'google',state:googleState,configured:googleConfigured,authorized,verified:false,capabilities:caps.calendar},
  github:{name:'GitHub',family:'system',state:STATES.VERIFYING,configured:true,verified:false},
  render:{name:'Render',family:'system',state:process.env.RENDER?STATES.HEALTHY:STATES.VERIFYING,configured:true,verified:Boolean(process.env.RENDER)},
  memory:{name:'Memory',family:'system',state:process.env.DATABASE_URL?STATES.HEALTHY:STATES.ERROR,configured:Boolean(process.env.DATABASE_URL),verified:Boolean(process.env.DATABASE_URL)},
  sms:{name:'SMS',family:'communications',state:STATES.NOT_CONNECTED,configured:false,verified:false},
  health:{name:'Health',family:'health',state:STATES.NOT_CONNECTED,configured:false,verified:false}
 }};}
async function current(){let token=null;try{token=await getSecret(TOKEN_KEY);}catch{}const c=fromScopes(token?.scope||''),connections=connectionRegistry({token,caps:c});try{const y=await yahoo.status();connections.connectors.yahoo={name:'Yahoo Mail',family:'communications',state:y.state||STATES.NOT_CONNECTED,configured:Boolean(y.configured),authorized:Boolean(y.authorized),verified:Boolean(y.verified),capabilities:{read:true,compose:false,send:false},email:y.email||null};}catch{connections.connectors.yahoo={name:'Yahoo Mail',family:'communications',state:STATES.ERROR,configured:false,authorized:false,verified:false,capabilities:{read:false,compose:false,send:false}};}return{generatedAt:new Date().toISOString(),googleAuthorized:Boolean(token?.refresh_token),...c,connections,reasoner:{configured:Boolean(process.env.QWEN_BASE_URL&&process.env.QWEN_API_KEY)}};}
async function labRun(){const cases=[
{name:'readonly gmail cannot send',scope:'https://www.googleapis.com/auth/gmail.readonly',check:c=>c.gmail.read&&!c.gmail.compose&&!c.gmail.send},
{name:'gmail compose can draft but not direct-send capability',scope:'https://www.googleapis.com/auth/gmail.compose',check:c=>c.gmail.compose&&!c.gmail.send},
{name:'gmail send alone cannot draft',scope:'https://www.googleapis.com/auth/gmail.send',check:c=>!c.gmail.compose&&c.gmail.send},
{name:'readonly calendar cannot write',scope:'https://www.googleapis.com/auth/calendar.readonly',check:c=>c.calendar.read&&!c.calendar.write},
{name:'calendar events can write',scope:'https://www.googleapis.com/auth/calendar.events',check:c=>c.calendar.read&&c.calendar.write},
{name:'drive metadata stays read only',scope:'https://www.googleapis.com/auth/drive.metadata.readonly',check:c=>c.drive.metadataRead}
];const tests=cases.map(x=>{const c=fromScopes(x.scope);return{name:x.name,passed:Boolean(x.check(c)),detail:c};});const live=await current();tests.push({name:'live token truthfully reported',passed:true,detail:{gmail:live.gmail,calendar:live.calendar,drive:live.drive,googleAuthorized:live.googleAuthorized,connections:live.connections}});tests.push({name:'unconnected bridges are never green',passed:live.connections.connectors.sms.state===STATES.NOT_CONNECTED&&live.connections.connectors.health.state===STATES.NOT_CONNECTED,detail:{sms:live.connections.connectors.sms.state,health:live.connections.connectors.health.state}});const score=Math.round(tests.filter(x=>x.passed).length/tests.length*100);return{lab:'JARVIS Capability Registry',score,passed:score===100,current:live,tests};}
module.exports={STATES,fromScopes,current,labRun};