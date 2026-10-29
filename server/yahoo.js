'use strict';
const {ImapFlow}=require('imapflow');
const {getSecret,setSecret,deleteSecret}=require('./vault');
const SECRET_KEY='yahoo_mail_v1';
let cache={at:0,status:null};

function normalizeEmail(v){return String(v||'').trim().toLowerCase();}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
function clientFor(secret){
  return new ImapFlow({
    host:'imap.mail.yahoo.com',
    port:993,
    secure:true,
    auth:{user:secret.email,pass:secret.appPassword},
    logger:false,
    greetingTimeout:12000,
    socketTimeout:20000,
    connectionTimeout:12000
  });
}
async function verifySecret(secret){
  const c=clientFor(secret);
  try{
    await c.connect();
    const lock=await c.getMailboxLock('INBOX');
    try{return {ok:true,mailbox:c.mailbox?.path||'INBOX',messages:Number(c.mailbox?.exists||0)}}
    finally{lock.release()}
  } finally {
    try{await c.logout()}catch{try{c.close()}catch{}}
  }
}
async function configure({email,appPassword}={}){
  email=normalizeEmail(email); appPassword=String(appPassword||'').replace(/\s+/g,'').trim();
  if(!validEmail(email))throw Object.assign(new Error('valid_yahoo_email_required'),{status:400});
  if(appPassword.length<8)throw Object.assign(new Error('yahoo_app_password_required'),{status:400});
  const candidate={email,appPassword,configuredAt:new Date().toISOString()};
  let verification;
  try{verification=await verifySecret(candidate)}
  catch(e){throw Object.assign(new Error('yahoo_authentication_failed'),{status:401,cause:e})}
  await setSecret(SECRET_KEY,candidate);
  cache={at:Date.now(),status:{configured:true,authorized:true,verified:true,state:'HEALTHY',email,verifiedAt:new Date().toISOString(),mailboxMessages:verification.messages}};
  return cache.status;
}
async function disconnect(){await deleteSecret(SECRET_KEY).catch(()=>{});cache={at:0,status:null};return{ok:true};}
async function status({force=false}={}){
  if(!force&&cache.status&&Date.now()-cache.at<5*60*1000)return cache.status;
  const secret=await getSecret(SECRET_KEY).catch(()=>null);
  if(!secret?.email||!secret?.appPassword){
    const s={configured:false,authorized:false,verified:false,state:'NOT_CONNECTED',email:null,verifiedAt:null};
    cache={at:Date.now(),status:s};return s;
  }
  try{
    const v=await verifySecret(secret);
    const s={configured:true,authorized:true,verified:true,state:'HEALTHY',email:secret.email,verifiedAt:new Date().toISOString(),mailboxMessages:v.messages};
    cache={at:Date.now(),status:s};return s;
  }catch(e){
    const s={configured:true,authorized:true,verified:false,state:'AUTH_REQUIRED',email:secret.email,verifiedAt:null,lastError:'Yahoo authentication needs attention.'};
    cache={at:Date.now(),status:s};return s;
  }
}
function addr(a){if(!a)return'';const list=Array.isArray(a)?a:[a];return list.map(x=>x?.name?x.name+(x.address?' <'+x.address+'>':''):x?.address||'').filter(Boolean).join(', ')}
async function inbox(limit=12){
  const secret=await getSecret(SECRET_KEY).catch(()=>null);
  if(!secret?.email||!secret?.appPassword)throw Object.assign(new Error('yahoo_not_connected'),{status:409,code:'AUTH_REQUIRED'});
  const c=clientFor(secret);const out=[];
  try{
    await c.connect();const lock=await c.getMailboxLock('INBOX');
    try{
      const exists=Number(c.mailbox?.exists||0); if(!exists)return[];
      const n=Math.min(25,Math.max(1,Number(limit)||12)),start=Math.max(1,exists-n+1);
      for await (const m of c.fetch(`${start}:*`,{uid:true,envelope:true,flags:true,internalDate:true})){
        out.push({id:String(m.uid),threadId:null,from:addr(m.envelope?.from),to:addr(m.envelope?.to),subject:m.envelope?.subject||'(No subject)',date:m.internalDate?new Date(m.internalDate).toISOString():null,internalDate:m.internalDate?new Date(m.internalDate).toISOString():null,snippet:'',unread:!(m.flags&&m.flags.has('\\Seen')),important:Boolean(m.flags&&m.flags.has('\\Flagged')),labels:[...(m.flags||[])],source:'yahoo'});
      }
    } finally {lock.release()}
  } catch(e){
    if(/auth|login|credentials|authentication/i.test(String(e.message||'')))throw Object.assign(new Error('yahoo_authentication_required'),{status:401,code:'AUTH_REQUIRED'});
    throw Object.assign(new Error('yahoo_inbox_unavailable'),{status:502});
  } finally {try{await c.logout()}catch{try{c.close()}catch{}}}
  return out.sort((a,b)=>Date.parse(b.internalDate||0)-Date.parse(a.internalDate||0)).slice(0,Math.min(25,Math.max(1,Number(limit)||12)));
}
module.exports={configure,disconnect,status,inbox};
