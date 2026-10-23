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
function sourceMeta(base,id,opts={}){
  const x=integration(base,id);const connected=x.status==='CONNECTED';
  const last=x.lastSuccessAt||null;
  return{
    connectionStatus:x.status||'UNKNOWN',
    freshnessStatus:connected?(last&&Date.now()-Date.parse(last)<180000?'LIVE':'STALE'):'UNKNOWN',
    lastAttemptAt:x.lastCheckedAt||null,
    lastSuccessAt:last,
    dataAsOf:opts.dataAsOf||last,
    staleAfterSeconds:180,
    coverage:opts.coverage||null,
    errorCode:x.lastError?'source_error':null
  };
}
async function hydratedBase(){
  const base=await engine.publicState();
  const gmailStatus=integration(base,'gmail');
  const feedState={integrations:{gmail:gmailStatus},live:{}};
  if(gmailStatus.status==='CONNECTED')await hydrateLiveFeeds(feedState);
  base.live={...(base.live||{}),...(feedState.live||{})};
  return base;
}
async function publicState(){
  const base=await hydratedBase();
  const gmailStatus=integration(base,'gmail');
  const inbox=(base.live.inbox||[]).map(redactSecurity);
  const career=base.live.career||[];
  const finance=base.live.finance||[];
  const security=(base.live.security||[]).map(redactSecurity);
  const unread=Number(base.live.unreadCount||0);
  base.metrics=[
    {label:'Needs You',value:(base.attention||[]).length,state:'decision queue'},
    {label:'Unread',value:unread,state:gmailStatus.status==='CONNECTED'?'gmail recent scan':gmailStatus.status||'unknown'},
    {label:'Career',value:career.length,state:'recent signals'},
    {label:'Finance',value:finance.length,state:'email-derived'},
    {label:'Hard Time',value:(base.calendar||[]).length,state:'calendar today'},
    {label:'Jarvis Active',value:(base.active||[]).length,state:'execution'}
  ];
  base.dashboard={
    generatedAt:new Date().toISOString(),
    inbox:{status:gmailStatus.status||'UNKNOWN',items:inbox,unread},
    career:{status:gmailStatus.status||'UNKNOWN',items:career},
    finance:{status:gmailStatus.status==='CONNECTED'?'EMAIL_DERIVED':'SOURCE_NEEDED',items:finance,note:gmailStatus.status==='CONNECTED'?'Financial activity inferred from recent email. Account balances are not connected yet.':'Connect a financial account source for balances and transactions.'},
    security:{status:gmailStatus.status||'UNKNOWN',items:security},
    health:{status:'SOURCE_NEEDED',freshness:'UNKNOWN',note:'JARVIS has no direct server-side health source. No medical values are assumed or stored in the public codebase.'},
    calendar:{status:integration(base,'calendar').status||'UNKNOWN',items:base.calendar||[]}
  };
  return base;
}
function messageItem(x){return{
  id:x.id,threadId:x.threadId||null,senderName:x.from||'Unknown sender',subject:x.subject||'(No subject)',snippet:x.snippet||'',receivedAt:x.receivedAt||null,
  category:String(x.category||'general').toUpperCase(),priority:x.priority||'LOW',requiresResponse:x.requiresResponse??null,reasonCodes:x.reasonCodes||[],unread:Boolean(x.unread),important:Boolean(x.important)
};}
function attentionItems(base,messages){
  const decisions=(base.attention||[]).map(d=>({id:`decision:${d.id}`,entityType:'decision',entityId:d.id,priority:'HIGH',title:d.question,reasonCodes:['pending_decision'],missionId:d.missionId||'jarvis'}));
  const signals=messages.filter(m=>m.priority==='HIGH').slice(0,4).map(m=>({id:`message:${m.id}`,entityType:'message',entityId:m.id,priority:'HIGH',title:m.subject,reasonCodes:m.reasonCodes?.length?m.reasonCodes:['high_priority_signal']}));
  return [...decisions,...signals];
}
async function cockpitState(){
  const base=await hydratedBase();
  const inbox=(base.live.inbox||[]).map(redactSecurity).map(messageItem);
  const career=(base.live.career||[]).map(messageItem);
  const finance=(base.live.finance||[]).map(messageItem);
  const security=(base.live.security||[]).map(redactSecurity).map(messageItem);
  const gmailHydratedAt=base.live.gmailHydratedAt||null;
  const systems=(base.system?.integrations||[]).map(x=>({id:x.id,name:x.name,status:x.status,lastCheckedAt:x.lastCheckedAt||null,lastSuccessAt:x.lastSuccessAt||null,details:x.details||null}));
  const healthy=systems.filter(x=>x.status==='CONNECTED').length;
  const timeline=(base.calendar||[]).map(e=>({...e,kind:'hard_time'}));
  const messages={sourceIds:['gmail'],unreadCount:Number(base.live.unreadCount||0),unreadCountScope:'recent_scan',totalCount:null,hasMore:inbox.length>=12,items:inbox};
  const attention=attentionItems(base,inbox);
  return{
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    timezone:'America/Detroit',
    sources:{
      gmail:sourceMeta(base,'gmail',{dataAsOf:gmailHydratedAt,coverage:{kind:'recent_filtered_messages',scannedLimit:20,windowDays:7,complete:false}}),
      calendar:sourceMeta(base,'calendar',{coverage:{kind:'primary_calendar_hard_time_today',complete:true}}),
      drive:sourceMeta(base,'drive'),github:sourceMeta(base,'github'),render:sourceMeta(base,'render'),memory:sourceMeta(base,'persistence')
    },
    now:{mode:base.now?.mode||'PERSONAL / LIVE',focus:base.now?.primaryFocus||null,detail:base.now?.detail||null,basis:(base.active||[]).length?'active_job':(base.attention||[]).length?'decision':base.now?.nextCommitment?'calendar':'mission',currentCommitment:null,nextCommitment:base.now?.nextCommitment||null,nextCommitmentText:base.now?.nextCommitmentText||null},
    timeline:{sourceIds:['calendar'],date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Detroit'}).format(new Date()),items:timeline,availability:integration(base,'calendar').status||'UNKNOWN'},
    attention:{totalCount:attention.length,items:attention},
    messages,
    career:{sourceIds:['gmail'],opportunities:career,candidateSignals:career,totalCount:career.length},
    money:{emailSignals:{sourceIds:['gmail'],items:finance,countScope:'recent_scan'},accounts:{connectionStatus:'NOT_CONNECTED',freshnessStatus:'UNKNOWN',balances:null,transactions:null}},
    security:{sourceIds:['gmail'],items:security,totalCount:security.length},
    health:{connectionStatus:'SOURCE_NEEDED',freshnessStatus:'UNKNOWN',lastSuccessAt:null,readings:null},
    home:{availability:'UNKNOWN',items:[]},creative:{availability:'UNKNOWN',items:[]},vehicle:{availability:'UNKNOWN',items:[]},
    projects:{items:(base.missions||[]).map(m=>({id:m.id,name:m.name,state:m.state,currentFocus:m.currentFocus||null,objective:m.objective||null,jobs:m.jobs?.length||0,pendingDecisions:m.decisions?.filter(d=>d.status==='pending').length||0})),totalCount:(base.missions||[]).length},
    jarvisActivity:{runningCount:(base.active||[]).length,waitingCount:Number((base.metrics||[]).find(m=>m.label==='Waiting')?.value||0),jobs:base.active||[],recentEvents:(base.events||[]).slice(0,8),historyScope:'retained_events'},
    quickActions:[{id:'view-inbox',label:'View Inbox',kind:'open_inspector',enabled:true},{id:'view-career',label:'Career',kind:'open_inspector',enabled:true},{id:'view-money',label:'Money',kind:'open_inspector',enabled:true},{id:'view-systems',label:'Systems',kind:'open_inspector',enabled:true}],
    decisions:base.attention||[],
    systems:{healthyCount:healthy,configuredCount:systems.length,items:systems}
  };
}
module.exports={publicState,cockpitState};
