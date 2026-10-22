const {getSecret,setSecret,deleteSecret}=require('./vault');
const TOKEN_KEY='google_oauth_v1';

async function tokenRecord(){
  const token=await getSecret(TOKEN_KEY);
  if(!token?.refresh_token)throw Object.assign(new Error('google_authorization_required'),{code:'AUTH_REQUIRED'});
  if(token.access_token&&Number(token.expires_at||0)>Date.now())return token;
  const body=new URLSearchParams({
    client_id:process.env.GOOGLE_CLIENT_ID,
    client_secret:process.env.GOOGLE_CLIENT_SECRET,
    refresh_token:token.refresh_token,
    grant_type:'refresh_token'
  });
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const data=await r.json();
  if(!r.ok){
    if(['invalid_grant','unauthorized_client'].includes(data.error)){await deleteSecret(TOKEN_KEY).catch(()=>{});throw Object.assign(new Error('google_authorization_required'),{code:'AUTH_REQUIRED'});}
    throw new Error(data.error_description||data.error||`google_refresh_http_${r.status}`);
  }
  const next={...token,...data,refresh_token:token.refresh_token,expires_at:Date.now()+Math.max(0,Number(data.expires_in||3600)-60)*1000};
  await setSecret(TOKEN_KEY,next);
  return next;
}

async function googleJson(url){
  const token=await tokenRecord();
  const r=await fetch(url,{headers:{authorization:`Bearer ${token.access_token}`,'user-agent':'jarvis-v3'}});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error?.message||`google_http_${r.status}`);
  return data;
}

function header(msg,name){return (msg.payload?.headers||[]).find(h=>String(h.name).toLowerCase()===name.toLowerCase())?.value||'';}
function classify(item){
  const hay=`${item.from} ${item.subject} ${item.snippet}`.toLowerCase();
  if(/security alert|verification code|sign[- ]?in/.test(hay))return 'security';
  if(/recruit|opportunity|interview|indeed|handshake|hiring|career/.test(hay))return 'career';
  if(/bank|credit|debit|payment|charge|purchase|statement|balance|deposit|refund|invoice|bill|due|subscription|renewal|trial/.test(hay))return 'finance';
  if(/order|delivery|shipped|instacart|amazon|doordash|pickup/.test(hay))return 'order';
  return 'general';
}
function priority(item){
  const hay=`${item.subject} ${item.snippet}`.toLowerCase();
  if(item.category==='security')return 'HIGH';
  if(item.category==='career'&&/interview|opportunity|respond|invited|recruiter/.test(hay))return 'HIGH';
  if(item.category==='finance'&&/due|declined|overdraft|past due|failed|fraud/.test(hay))return 'HIGH';
  return item.unread?'MEDIUM':'LOW';
}

async function gmailFeed(){
  const q=new URLSearchParams({q:'newer_than:7d -in:spam -in:trash -category:promotions',maxResults:'20'});
  const list=await googleJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${q}`);
  const rows=await Promise.all((list.messages||[]).slice(0,20).map(async x=>{
    const p=new URLSearchParams({format:'metadata'});
    ['From','Subject','Date'].forEach(h=>p.append('metadataHeaders',h));
    const msg=await googleJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(x.id)}?${p}`);
    const item={
      id:msg.id,
      threadId:msg.threadId,
      from:header(msg,'From'),
      subject:header(msg,'Subject')||'(No subject)',
      receivedAt:Number(msg.internalDate||0)?new Date(Number(msg.internalDate)).toISOString():null,
      snippet:msg.snippet||'',
      unread:(msg.labelIds||[]).includes('UNREAD'),
      important:(msg.labelIds||[]).includes('IMPORTANT')
    };
    item.category=classify(item);
    item.priority=priority(item);
    return item;
  }));
  rows.sort((a,b)=>Date.parse(b.receivedAt||0)-Date.parse(a.receivedAt||0));
  return{
    messages:rows.slice(0,12),
    unread:rows.filter(x=>x.unread).length,
    career:rows.filter(x=>x.category==='career').slice(0,6),
    finance:rows.filter(x=>x.category==='finance').slice(0,6),
    security:rows.filter(x=>x.category==='security').slice(0,4)
  };
}

async function hydrateLiveFeeds(state){
  state.live=state.live||{};
  try{
    const feed=await gmailFeed();
    state.live.inbox=feed.messages;
    state.live.unreadCount=feed.unread;
    state.live.career=feed.career;
    state.live.finance=feed.finance;
    state.live.security=feed.security;
    state.live.gmailHydratedAt=new Date().toISOString();
    if(state.integrations.gmail?.status==='CONNECTED')state.integrations.gmail.details=`${feed.unread} unread recent messages · live feed hydrated.`;
  }catch(err){
    console.error('live Gmail feed failed',err.message);
    state.live.gmailError=err.message;
  }
  return state;
}

module.exports={hydrateLiveFeeds};
