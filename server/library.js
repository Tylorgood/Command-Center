const google=require('./google');
const knowledge=require('./knowledge');
let inFlight=null;
async function syncFromState(base,{force=false}={}){
  if(inFlight&&!force)return inFlight;
  inFlight=(async()=>{const driveConnected=(base.system?.integrations||[]).some(x=>x.id==='drive'&&x.status==='CONNECTED');let driveFiles=[];let driveError=null;if(driveConnected){try{driveFiles=await google.driveLibrary(100);}catch(e){driveError='drive_metadata_unavailable';console.error('knowledge drive sync failed',String(e.message||'source_error').slice(0,160));}}
    const result=await knowledge.syncKnowledge({gmailItems:base.live?.knowledgeMessages||base.live?.inbox||[],driveFiles,projects:base.missions||[]});
    return{...result,driveError};})();
  try{return await inFlight}finally{inFlight=null;}
}
async function summary(base){const sync=await syncFromState(base);try{return{status:'CONNECTED',sync,...await knowledge.librarySummary()};}catch(e){return{status:e.code==='SOURCE_NEEDED'?'SOURCE_NEEDED':'ERROR',error:'knowledge_library_unavailable',sync,counts:{},documents:{count:0,contentStatus:'UNKNOWN'},recent:[]};}}
module.exports={syncFromState,summary,knowledge};
