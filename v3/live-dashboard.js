const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const ago=v=>{const t=Date.parse(v);if(!Number.isFinite(t))return'—';const s=Math.max(0,Math.floor((Date.now()-t)/1000));return s<60?`${s}s ago`:s<3600?`${Math.floor(s/60)}m ago`:s<86400?`${Math.floor(s/3600)}h ago`:`${Math.floor(s/86400)}d ago`;};
function sender(v=''){return String(v).replace(/<[^>]+>/g,'').replace(/^"|"$/g,'').trim()||'Unknown sender';}
function badge(v=''){return `<span class="feed-badge ${esc(String(v).toLowerCase())}">${esc(v)}</span>`;}
function item(m){return `<article class="feed-item ${m.unread?'unread':''}"><div class="feed-top"><b>${esc(m.subject||'(No subject)')}</b>${badge(m.priority||'LOW')}</div><div class="feed-from">${esc(sender(m.from))} · ${esc(ago(m.receivedAt))}</div><p>${esc(m.snippet||'')}</p><div class="feed-tags">${badge((m.category||'general').toUpperCase())}${m.unread?badge('UNREAD'):''}</div></article>`;}
function empty(title,detail,kind=''){return `<div class="state-card ${kind}"><b>${esc(title)}</b><span>${esc(detail)}</span></div>`;}
function setHtml(id,html){const el=$(id);if(el)el.innerHTML=html;}
function setText(id,value){const el=$(id);if(el)el.textContent=value;}

function renderInbox(d){const items=d?.inbox?.items||[];setText('#inboxCount',`${d?.inbox?.unread||0} UNREAD`);setHtml('#inboxFeed',items.length?items.slice(0,8).map(item).join(''):empty('Inbox is quiet.','No recent non-promotional messages found.','success'));}
function renderCareer(d){const items=d?.career?.items||[];setText('#careerCount',`${items.length} SIGNAL${items.length===1?'':'S'}`);setHtml('#careerFeed',items.length?items.map(item).join(''):empty('No fresh career signals.','JARVIS is watching recent Gmail for recruiter, interview, hiring, and opportunity messages.','success'));}
function renderFinance(d){const f=d?.finance||{},items=f.items||[];setText('#financeCount',f.status||'SOURCE');setHtml('#financeFeed',(items.length?items.map(item).join(''):'')+empty(items.length?'Balance source not connected.':'No recent finance emails detected.',f.note||'Connect a financial source for live balances and transactions.',items.length?'stale':'success'));}
function renderHealth(d){const h=d?.health||{};setText('#healthCount',h.status||'SOURCE');setHtml('#healthFeed',`<div class="health-status"><div class="health-orb ${String(h.status||'').toLowerCase()}"><i></i></div><div><b>Health bridge</b><span>${esc(h.freshness||'not synchronized')}</span></div></div>${empty('Private health source is not bridged to this server.',h.note||'No health data is being assumed.','stale')}`);}
function renderSecurity(d){const items=d?.security?.items||[];setText('#securityCount',`${items.length} RECENT`);setHtml('#securityFeed',items.length?items.map(item).join(''):empty('No recent security signals.','No recent verification or sign-in messages detected.','success'));}
function renderSnapshot(s){const d=s.dashboard||{};renderInbox(d);renderCareer(d);renderFinance(d);renderHealth(d);renderSecurity(d);setText('#dashboardFreshness',d.generatedAt?`LIVE · ${ago(d.generatedAt)}`:'NOT HYDRATED');}

async function hydrate(){
  try{
    const r=await fetch('/api/state',{credentials:'same-origin',headers:{accept:'application/json'}});
    if(!r.ok)return;
    renderSnapshot(await r.json());
  }catch{}
}

hydrate();
setInterval(()=>{if(document.visibilityState==='visible')hydrate();},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')hydrate();});
