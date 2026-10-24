const http=require('http');
const crypto=require('crypto');
const {Pool}=require('pg');

const SENSOR_PATH='/api/sensors/messages';
const HEALTH_PATH='/api/sensors/messages/health';
const MAX_BODY=1024*1024;
let pool=null;
let ready=null;

function db(){
  if(!process.env.DATABASE_URL) throw new Error('sensor_database_unavailable');
  if(!pool) pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});
  return pool;
}
function stable(prefix,value){return `${prefix}_${crypto.createHash('sha256').update(String(value)).digest('hex').slice(0,24)}`;}
function safeEqual(a,b){
  const A=Buffer.from(String(a||'')),B=Buffer.from(String(b||''));
  return A.length===B.length&&A.length>0&&crypto.timingSafeEqual(A,B);
}
function configured(){return Boolean(process.env.JARVIS_SENSOR_KEY&&process.env.DATABASE_URL);}
function authorized(req){return safeEqual(req.headers['x-jarvis-sensor-key'],process.env.JARVIS_SENSOR_KEY);}
function reply(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(obj));}
function readBody(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>MAX_BODY){reject(Object.assign(new Error('body_too_large'),{status:413}));req.destroy();}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(Object.assign(new Error('invalid_json'),{status:400}));}});req.on('error',reject);});}
function cleanText(v,max=1000){return String(v||'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim().slice(0,max);}
function messageKey(conversationId,m,index){return stable('gmsg',`${conversationId}|${m.direction||''}|${m.time||''}|${m.text||''}|${index}`);}
async function init(){
  if(!ready) ready=db().query(`
    CREATE TABLE IF NOT EXISTS jarvis_message_sensor_runs(
      id text PRIMARY KEY, device_id text, chat_count integer NOT NULL DEFAULT 0,
      thread_count integer NOT NULL DEFAULT 0, message_count integer NOT NULL DEFAULT 0,
      captured_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS jarvis_message_sensor_runs_created_idx ON jarvis_message_sensor_runs(created_at DESC);
  `);
  return ready;
}
async function upsertEvent({eventType,externalId,title,eventAt,data,confidence=.9}){
  const id=stable('evt',`google_messages:${externalId}:${eventType}`);
  await db().query(`INSERT INTO jarvis_events(id,event_type,source_type,source_external_id,title,event_at,data,confidence,updated_at)
    VALUES($1,$2,'google_messages',$3,$4,$5,$6::jsonb,$7,now())
    ON CONFLICT(source_type,source_external_id,event_type) DO UPDATE SET
    title=excluded.title,event_at=COALESCE(excluded.event_at,jarvis_events.event_at),
    data=jarvis_events.data||excluded.data,confidence=GREATEST(jarvis_events.confidence,excluded.confidence),updated_at=now()`,
    [id,eventType,String(externalId),cleanText(title,300)||'(Text message)',eventAt||null,JSON.stringify(data||{}),confidence]);
  return id;
}
async function upsertSituation(conversationId,name,status,summary,snippet,unread,eventId){
  const canonical=`google-messages-thread:${conversationId}`,id=stable('sit',canonical);
  const priority=unread>0||status==='WAITING_ON_ME'?'MEDIUM':'LOW';
  const action=status==='WAITING_ON_ME'?'Review the conversation and decide whether to reply':status==='WAITING_ON_THEM'?'Track for a reply':'Review if relevant';
  await db().query(`INSERT INTO jarvis_situations(id,canonical_key,title,domain,status,summary,recommended_action,priority,confidence,data,last_seen_at,updated_at)
    VALUES($1,$2,$3,'people',$4,$5,$6,$7,$8,$9::jsonb,now(),now())
    ON CONFLICT(canonical_key) DO UPDATE SET title=excluded.title,status=excluded.status,summary=excluded.summary,
    recommended_action=excluded.recommended_action,priority=excluded.priority,confidence=GREATEST(jarvis_situations.confidence,excluded.confidence),
    data=jarvis_situations.data||excluded.data,last_seen_at=now(),updated_at=now()`,
    [id,canonical,cleanText(name,200)||'Text conversation',status,cleanText(summary,800),action,priority,.9,JSON.stringify({sourceType:'google_messages',conversationId:String(conversationId),latestSnippet:cleanText(snippet,500),unread:Number(unread||0),eventId})]);
  const linkId=stable('slink',`${id}:thread:google_messages:${conversationId}`);
  await db().query(`INSERT INTO jarvis_situation_links(id,situation_id,link_type,target_type,target_id,target_label,confidence,reason,evidence,updated_at)
    VALUES($1,$2,'source','google_messages_thread',$3,$4,1,'exact_thread_id',$5::jsonb,now())
    ON CONFLICT(situation_id,link_type,target_type,target_id) DO UPDATE SET target_label=excluded.target_label,evidence=jarvis_situation_links.evidence||excluded.evidence,updated_at=now()`,
    [linkId,id,String(conversationId),cleanText(name,200),JSON.stringify({conversationId:String(conversationId)})]);
  return id;
}
async function ingest(body={}){
  await init();
  const chats=Array.isArray(body.chats)?body.chats.slice(0,100):[];
  const threads=Array.isArray(body.threads)?body.threads.slice(0,40):[];
  const capturedAt=body.capturedAt&&Number.isFinite(Date.parse(body.capturedAt))?body.capturedAt:new Date().toISOString();
  const chatById=new Map(chats.filter(x=>x&&x.id).map(x=>[String(x.id),x]));
  let messageCount=0,staged=0;
  for(const chat of chats){
    if(!chat?.id) continue;
    const conversationId=String(chat.id),name=cleanText(chat.name,200)||'Text conversation',snippet=cleanText(chat.snippet,500),unread=Math.max(0,Number(chat.unread||0));
    const eventId=await upsertEvent({eventType:'message.thread_observed',externalId:`thread:${conversationId}`,title:name,eventAt:capturedAt,data:{conversationId,name,snippet,time:cleanText(chat.time,100),unread,deviceId:cleanText(body.deviceId,120)}});
    if(unread>0){await upsertSituation(conversationId,name,'WAITING_ON_ME',`${name} has an unread text conversation.`,snippet,unread,eventId);staged++;}
  }
  for(const thread of threads){
    if(!thread?.conversationId) continue;
    const conversationId=String(thread.conversationId),chat=chatById.get(conversationId)||{},name=cleanText(thread.name||chat.name,200)||'Text conversation';
    const messages=Array.isArray(thread.messages)?thread.messages.slice(-80):[];
    for(let i=0;i<messages.length;i++){
      const m=messages[i]||{},direction=m.direction==='sent'?'sent':'received',text=cleanText(m.text,4000);
      if(!text) continue;
      await upsertEvent({eventType:direction==='sent'?'message.sent':'message.received',externalId:messageKey(conversationId,m,i),title:`${direction==='sent'?'To':'From'} ${name}`,eventAt:capturedAt,data:{conversationId,name,direction,text,time:cleanText(m.time,120),deviceId:cleanText(body.deviceId,120)},confidence:.96});
      messageCount++;
    }
    const latest=[...messages].reverse().find(m=>cleanText(m?.text,10));
    if(latest){
      const direction=latest.direction==='sent'?'sent':'received',status=direction==='sent'?'WAITING_ON_THEM':'WAITING_ON_ME',snippet=cleanText(latest.text,500);
      const eventId=await upsertEvent({eventType:'message.thread_state',externalId:`state:${conversationId}`,title:name,eventAt:capturedAt,data:{conversationId,name,latestDirection:direction,latestText:snippet,latestTime:cleanText(latest.time,120)},confidence:.94});
      await upsertSituation(conversationId,name,status,direction==='sent'?`You sent the latest text to ${name}.`:`${name} sent the latest text in this conversation.`,snippet,Number(chat.unread||0),eventId);
      staged++;
    }
  }
  const runId=stable('msgrun',`${body.deviceId||'unknown'}:${capturedAt}:${chats.length}:${threads.length}:${messageCount}`);
  await db().query(`INSERT INTO jarvis_message_sensor_runs(id,device_id,chat_count,thread_count,message_count,captured_at)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,[runId,cleanText(body.deviceId,120)||null,chats.length,threads.length,messageCount,capturedAt]);
  return{ok:true,runId,chats:chats.length,threads:threads.length,messages:messageCount,situationsTouched:staged,capturedAt};
}

const originalCreateServer=http.createServer.bind(http);
http.createServer=function patchedCreateServer(listener){
  return originalCreateServer(async(req,res)=>{
    try{
      const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
      if(url.pathname===HEALTH_PATH&&req.method==='GET') return reply(res,200,{ok:true,sensor:'google_messages',configured:configured(),time:new Date().toISOString()});
      if(url.pathname===SENSOR_PATH&&req.method==='POST'){
        if(!configured()) return reply(res,503,{error:'sensor_not_configured'});
        if(!authorized(req)) return reply(res,401,{error:'sensor_unauthorized'});
        const result=await ingest(await readBody(req));
        console.log('google messages sensor sync',{chats:result.chats,threads:result.threads,messages:result.messages,situations:result.situationsTouched});
        return reply(res,200,result);
      }
      return listener(req,res);
    }catch(err){
      if(req.url&&String(req.url).startsWith(SENSOR_PATH)) return reply(res,err.status||500,{error:err.message||'sensor_error'});
      return listener(req,res);
    }
  });
};

init().then(()=>console.log('Google Messages sensor preload ready',{configured:configured()})).catch(e=>console.error('Google Messages sensor preload init failed',String(e.message||e).slice(0,180)));
