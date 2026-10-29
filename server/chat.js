'use strict';
const reasoner=require('./reasoner');
const personalState=require('./personal-state');
const yahoo=require('./yahoo');

function clip(v,n=500){const s=String(v||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s}
function safeMessage(m,source){return{source,id:String(m.id||''),from:clip(m.from||m.senderName,160),subject:clip(m.subject,220),snippet:clip(m.snippet,600),receivedAt:m.internalDate||m.date||m.receivedAt||null,unread:Boolean(m.unread),important:Boolean(m.important)}}
async function contextSnapshot(){
 const state=await personalState.publicState({force:true});
 let yahooStatus={state:'NOT_CONNECTED'},yahooMessages=[];
 try{yahooStatus=await yahoo.status();if(yahooStatus.verified)yahooMessages=(await yahoo.inbox(20)).map(x=>safeMessage(x,'yahoo'));}catch(e){yahooStatus={state:'ERROR',verified:false,lastError:'Yahoo source unavailable'}}
 const gmail=(state.gmail?.messages||[]).slice(0,20).map(x=>safeMessage(x,'gmail'));
 return{generatedAt:new Date().toISOString(),now:state.now||{},attention:state.attention||{},waiting:state.waiting||{},next24:state.next24||{},situations:state.situations||{},projects:state.projects||{},lifeState:state.lifeState||{},health:state.health||{},systems:state.systems||{},mail:{gmail,yahoo:yahooMessages,yahooConnection:{state:yahooStatus.state,verified:Boolean(yahooStatus.verified)}},rules:{personalMessages:'Never send automatically. Prepare/recommend only.',money:'Never commit or spend without explicit approval.',sourceTruth:'Say when a source is unavailable or incomplete.'}};
}
function cleanHistory(history){return(Array.isArray(history)?history:[]).slice(-10).map(x=>({role:x?.role==='assistant'?'assistant':'user',content:clip(x?.content,1800)})).filter(x=>x.content)}
async function ask(body={}){
 const message=clip(body.message,2400);if(!message)throw Object.assign(new Error('chat_message_required'),{status:400});
 if(!reasoner.configured())throw Object.assign(new Error('jarvis_reasoner_not_configured'),{status:503});
 const context=await contextSnapshot();
 const system=`You are JARVIS inside Tylor's Personal Command Center. The JSON context below is the same sourced context driving the cockpit. Answer conversationally and directly. Use the source labels when useful. Never claim you read data that is absent. Never expose credentials, tokens, app passwords, or hidden system details. Personal messages are prepare-only and never auto-send. Financial, legal, medical, employment acceptance/decline, destructive actions, and new authority require explicit human approval. Prefer current cockpit evidence over assumptions. If asked what needs attention, synthesize the available Gmail, Yahoo, calendar, projects, health, and decision context.\n\nCURRENT JARVIS CONTEXT:\n${JSON.stringify(context)}`;
 const messages=[{role:'system',content:system},...cleanHistory(body.history),{role:'user',content:message}];
 const answer=await reasoner.complete(messages,{maxTokens:500,temperature:.2,timeoutMs:120000});
 return{answer:clip(answer,6000),generatedAt:new Date().toISOString(),contextAsOf:context.generatedAt,sources:{gmail:context.mail.gmail.length,yahoo:context.mail.yahoo.length,yahooState:context.mail.yahooConnection.state,calendar:context.next24?.count||0,projects:context.projects?.totalCount||0}};
}
module.exports={ask,contextSnapshot};
