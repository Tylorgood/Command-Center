const contextEngine=require('./context-engine');
const actionPolicy=require('./action-policy');
const preparations=require('./preparations');
const verifier=require('./verifier');
const capabilities=require('./capabilities');

async function run(cockpit){
  const rebuild=await contextEngine.rebuildFromCockpit(cockpit||{});
  const situations=await contextEngine.listSituations(50);
  const gmail=situations.find(s=>s.data?.sourceType==='gmail'&&s.status==='WAITING_ON_ME')||situations.find(s=>s.data?.sourceType==='gmail')||null;
  const tests=[];
  tests.push({name:'real_signal_ingestion',passed:(rebuild.processedEvents||0)>0,detail:{processedEvents:rebuild.processedEvents||0,stagedSituations:rebuild.stagedSituations||0}});
  tests.push({name:'real_situation_available',passed:Boolean(gmail),detail:gmail?{id:gmail.id,domain:gmail.domain,status:gmail.status,linkCount:gmail.link_count}:null});
  if(!gmail){
    const score=Math.round(tests.filter(t=>t.passed).length/tests.length*100);
    return{lab:'JARVIS Real Situation E2E',score,passed:false,tests,blocked:'No current Gmail situation was available for a real preparation test.'};
  }
  const policy=await actionPolicy.proposeForSituation(gmail);
  tests.push({name:'policy_before_action',passed:['SUGGEST','PREPARE','ASK','ACT'].includes(policy.mode),detail:{mode:policy.mode,actionType:policy.actionType,risk:policy.risk,reason:policy.reason}});
  const caps=await capabilities.current();
  tests.push({name:'capability_truthfulness',passed:Boolean(caps.gmail?.read)&&caps.gmail?.compose===false&&caps.gmail?.send===false,detail:{gmail:caps.gmail,calendar:caps.calendar,drive:caps.drive}});
  let preparation=null,verification=null;
  if(['PREPARE','ASK'].includes(policy.mode)){
    try{
      preparation=await preparations.prepare(gmail.id,policy);
      tests.push({name:'real_work_prepared',passed:Boolean(preparation?.id&&preparation?.body),detail:{actionType:preparation?.action_type,status:preparation?.status,bodyLength:String(preparation?.body||'').length,draftQuality:preparation?.artifact?.draftQuality||null,threadMessageCount:preparation?.artifact?.threadMessageCount||null,attachmentCount:(preparation?.artifact?.attachments||[]).length,matchedDocumentCount:(preparation?.artifact?.matchedDocuments||[]).length}});
      verification=await verifier.verifyPreparation(preparation.id);
      tests.push({name:'prepared_work_round_trip_verified',passed:verification.passed===true,detail:{verificationType:verification.verification_type,passed:verification.passed,observed:verification.observed}});
      tests.push({name:'no_external_side_effect',passed:preparation?.artifact?.canSend===false,detail:{canCreateGmailDraft:preparation?.artifact?.canCreateGmailDraft,canSend:preparation?.artifact?.canSend,note:'Lab prepares only private JARVIS work; no Gmail send endpoint is called.'}});
    }catch(e){tests.push({name:'real_work_prepared',passed:false,detail:String(e.message||e).slice(0,180)});}
  }else{
    tests.push({name:'real_work_prepared',passed:policy.mode==='SUGGEST',detail:`Policy mode ${policy.mode}; no preparation executed.`});
  }
  const passedCount=tests.filter(t=>t.passed).length,score=Math.round(passedCount/tests.length*100);
  return{lab:'JARVIS Real Situation E2E',runAt:new Date().toISOString(),score,passed:score===100,realSituation:{id:gmail.id,domain:gmail.domain,status:gmail.status,priority:gmail.priority,confidence:gmail.confidence},policy:{mode:policy.mode,actionType:policy.actionType,risk:policy.risk},tests};
}
module.exports={run};
