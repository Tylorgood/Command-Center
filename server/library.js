const google=require('./google');
const knowledge=require('./knowledge');
const enrichment=require('./knowledge-enrichment');
const truthEngine=require('./truth-engine');
const contextEngine=require('./context-engine');
let inFlight=null,projectsSeeded=false,seedChecked=false;
async function ensureSeedState(){if(seedChecked)return;seedChecked=true;try{const s=await knowledge.librarySummary();projectsSeeded=Number(s.counts?.project||0)>0;}catch{projectsSeeded=false;}}
async function syncFromState(base,{force=false}={}){
  if(inFlight&&!force)return inFlight;
  inFlight=(async()=>{
    await ensureSeedState();
    const driveConnected=(base.system?.integrations||[]).some(x=>x.id==='drive'&&x.status==='CONNECTED');
    let driveFiles=[],driveError=null;
    if(driveConnected){try{driveFiles=await google.driveLibrary(100);}catch(e){driveError='drive_metadata_unavailable';console.error('knowledge drive sync failed',String(e.message||'source_error').slice(0,160));}}
    const projects=projectsSeeded?[]:(base.missions||[]);
    const gmailItems=(base.live?.knowledgeMessages||base.live?.inbox||[]).filter(m=>String(m?.category||'').toLowerCase()!=='security');
    const result=await knowledge.syncKnowledge({gmailItems,driveFiles,projects});
    for(const m of gmailItems){try{const raw=String(m.from||m.senderName||'');const match=raw.match(/^(.*?)\s*<([^>]+)>$/);const senderEmail=(match?match[2]:raw).trim().toLowerCase();const observed=await truthEngine.observeMessage({source:'gmail',sourceRecordId:String(m.id),threadId:m.threadId,senderName:match?match[1].replace(/^"|"$/g,'').trim():null,senderEmail:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)?senderEmail:null,from:raw,subject:m.subject,timestamp:m.receivedAt,snippet:m.snippet,automated:/no-?reply|mailer|newsletter|notification|alert/i.test(raw)});await contextEngine.attachEvidence({evidenceId:observed.evidence.id,threadId:m.threadId||m.id,senderEntityId:observed.entity?.id||null,direction:'INBOUND'});}catch(e){console.error('gmail truth ingest failed',String(e.message||'error').slice(0,120));}}
    for(const f of driveFiles){try{await truthEngine.ingestEvidence({source:'google_drive',sourceRecordId:String(f.id),type:'document',sourceTimestamp:f.modifiedTime||f.createdTime||null,rawReference:f.webViewLink||null,participants:(f.owners||[]).map(x=>x.emailAddress||x.displayName).filter(Boolean),content:{name:f.name,mimeType:f.mimeType},ingestionMethod:'google_drive_connector',confidence:1,metadata:{createdTime:f.createdTime||null,parents:f.parents||[]}});}catch(e){console.error('drive truth ingest failed',String(e.message||'error').slice(0,120));}}
    if(!result?.error&&projects.length)projectsSeeded=true;
    let maintenance=null;try{maintenance=await enrichment.maintain();}catch(e){console.error('knowledge enrichment failed',String(e.message||'error').slice(0,160));}
    return{...result,driveError,maintenance};
  })();
  try{return await inFlight}finally{inFlight=null;}
}
async function summary(base){const sync=await syncFromState(base);try{return{status:'CONNECTED',sync,...await knowledge.librarySummary()};}catch(e){return{status:e.code==='SOURCE_NEEDED'?'SOURCE_NEEDED':'ERROR',error:'knowledge_library_unavailable',sync,counts:{},documents:{count:0,contentStatus:'UNKNOWN'},recent:[]};}}
module.exports={syncFromState,summary,knowledge};
