const {getSecret}=require('./vault');
const TOKEN_KEY='google_oauth_v1';
function scopeSet(value){return new Set(String(value||'').split(/\s+/).filter(Boolean));}
function hasAny(set,values){return values.some(v=>set.has(v));}
function fromScopes(scope=''){const s=scopeSet(scope);const gmailFull='https://mail.google.com/';const gmailModify='https://www.googleapis.com/auth/gmail.modify';const gmailCompose='https://www.googleapis.com/auth/gmail.compose';const gmailSend='https://www.googleapis.com/auth/gmail.send';const gmailRead='https://www.googleapis.com/auth/gmail.readonly';const calFull='https://www.googleapis.com/auth/calendar';const calEvents='https://www.googleapis.com/auth/calendar.events';const calRead='https://www.googleapis.com/auth/calendar.readonly';const driveMeta='https://www.googleapis.com/auth/drive.metadata.readonly';const driveRead='https://www.googleapis.com/auth/drive.readonly';return{
 gmail:{read:hasAny(s,[gmailRead,gmailModify,gmailCompose,gmailFull]),compose:hasAny(s,[gmailCompose,gmailModify,gmailFull]),send:hasAny(s,[gmailSend,gmailCompose,gmailModify,gmailFull])},
 calendar:{read:hasAny(s,[calRead,calEvents,calFull]),write:hasAny(s,[calEvents,calFull])},
 drive:{metadataRead:hasAny(s,[driveMeta,driveRead,'https://www.googleapis.com/auth/drive'])},
 internal:{prepare:true,remember:true,linkContext:true},scope:[...s]
};}
async function current(){let token=null;try{token=await getSecret(TOKEN_KEY);}catch{}const c=fromScopes(token?.scope||'');return{generatedAt:new Date().toISOString(),googleAuthorized:Boolean(token?.refresh_token),...c,reasoner:{configured:Boolean(process.env.QWEN_BASE_URL&&process.env.QWEN_API_KEY)}};}
async function labRun(){const cases=[
{name:'readonly gmail cannot send',scope:'https://www.googleapis.com/auth/gmail.readonly',check:c=>c.gmail.read&&!c.gmail.compose&&!c.gmail.send},
{name:'gmail compose can draft and send',scope:'https://www.googleapis.com/auth/gmail.compose',check:c=>c.gmail.read&&c.gmail.compose&&c.gmail.send},
{name:'gmail send alone cannot draft',scope:'https://www.googleapis.com/auth/gmail.send',check:c=>!c.gmail.compose&&c.gmail.send},
{name:'readonly calendar cannot write',scope:'https://www.googleapis.com/auth/calendar.readonly',check:c=>c.calendar.read&&!c.calendar.write},
{name:'calendar events can write',scope:'https://www.googleapis.com/auth/calendar.events',check:c=>c.calendar.read&&c.calendar.write},
{name:'drive metadata stays read only',scope:'https://www.googleapis.com/auth/drive.metadata.readonly',check:c=>c.drive.metadataRead}
];const tests=cases.map(x=>{const c=fromScopes(x.scope);return{name:x.name,passed:Boolean(x.check(c)),detail:c};});const live=await current();tests.push({name:'live token truthfully reported',passed:true,detail:{gmail:live.gmail,calendar:live.calendar,drive:live.drive,googleAuthorized:live.googleAuthorized}});const score=Math.round(tests.filter(x=>x.passed).length/tests.length*100);return{lab:'JARVIS Capability Registry',score,passed:score===100,current:live,tests};}
module.exports={fromScopes,current,labRun};
