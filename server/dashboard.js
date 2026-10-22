const engine=require('./engine');
const {hydrateLiveFeeds}=require('./live-feeds');

function integration(base,id){return (base.system?.integrations||[]).find(x=>x.id===id)||{};}
function redactSecurity(item){
  if(item?.category!=='security')return item;
  return{
    ...item,
    subject:String(item.subject||'Security message').replace(/\b\d{4,8}\b/g,'••••••'),
    snippet:'Security or verification message detected. Open Gmail to view sensitive details.'
  };
}

async function publicState(){
  const base=await engine.publicState();
  const gmailStatus=integration(base,'gmail');
  const feedState={integrations:{gmail:gmailStatus},live:{}};
  if(gmailStatus.status==='CONNECTED')await hydrateLiveFeeds(feedState);
  base.live={...(base.live||{}),...(feedState.live||{})};

  const inbox=(base.live.inbox||[]).map(redactSecurity);
  const career=base.live.career||[];
  const finance=base.live.finance||[];
  const security=(base.live.security||[]).map(redactSecurity);
  const unread=Number(base.live.unreadCount||0);

  base.metrics=[
    {label:'Needs You',value:(base.attention||[]).length,state:'decision queue'},
    {label:'Unread',value:unread,state:gmailStatus.status==='CONNECTED'?'gmail live':gmailStatus.status||'unknown'},
    {label:'Career',value:career.length,state:'recent signals'},
    {label:'Finance',value:finance.length,state:'email-derived'},
    {label:'Hard Time',value:(base.calendar||[]).length,state:'calendar today'},
    {label:'Jarvis Active',value:(base.active||[]).length,state:'execution'}
  ];

  base.dashboard={
    generatedAt:new Date().toISOString(),
    inbox:{status:gmailStatus.status||'UNKNOWN',items:inbox,unread},
    career:{status:gmailStatus.status||'UNKNOWN',items:career},
    finance:{
      status:gmailStatus.status==='CONNECTED'?'EMAIL_DERIVED':'SOURCE_NEEDED',
      items:finance,
      note:gmailStatus.status==='CONNECTED'?'Financial activity inferred from recent email. Account balances are not connected yet.':'Connect a financial account source for balances and transactions.'
    },
    security:{status:gmailStatus.status||'UNKNOWN',items:security},
    health:{
      status:'BRIDGE_NEEDED',
      freshness:'not server-synced',
      note:'Health is available through your connected Health source in ChatGPT, but JARVIS does not yet have a direct server-side health bridge. No medical values are copied into the public codebase.'
    },
    calendar:{status:integration(base,'calendar').status||'UNKNOWN',items:base.calendar||[]}
  };
  return base;
}

module.exports={publicState};
