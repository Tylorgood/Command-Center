const http=require('http');
const {requireAuth}=require('./auth');
const S=require('./truth-schema');
const I=require('./truth-identity');
const C=require('./truth-core');
const Q=require('./truth-query');
const H=require('./truth-history');
const M=require('./truth-maintenance');
const MAX_BODY=512000;
function json(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'});res.end(JSON.stringify(obj));}
function body(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>MAX_BODY){reject(Object.assign(new Error('body_too_large'),{status:413}));req.destroy();}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(Object.assign(new Error('invalid_json'),{status:400}));}});req.on('error',reject);});}
function mutationAllowed(req){if(['GET','HEAD','OPTIONS'].includes(req.method))return true;if(String(req.headers['sec-fetch-site']||'').toLowerCase()==='cross-site')return false;const origin=req.headers.origin;if(!origin)return true;try{const u=new URL(origin);return u.host===req.headers.host&&u.protocol==='https:'}catch{return false}}
async function route(req,res,url,user){
 if(url.pathname==='/api/truth/summary'&&req.method==='GET')return json(res,200,await Q.summary());
 if(url.pathname==='/api/truth/field-proof'&&req.method==='GET')return json(res,200,await H.fieldProof());
 if(url.pathname==='/api/truth/evidence'&&req.method==='GET')return json(res,200,{items:await Q.recentEvidence(url.searchParams.get('limit')||50)});
 const invalidate=url.pathname.match(/^\/api\/truth\/evidence\/([^/]+)\/invalidate$/);if(invalidate&&req.method==='POST')return json(res,200,await M.invalidateEvidence(decodeURIComponent(invalidate[1]),(await body(req)).reason||'source_removed'));
 const evidence=url.pathname.match(/^\/api\/truth\/evidence\/([^/]+)$/);if(evidence&&req.method==='GET'){const x=await Q.evidenceDetail(decodeURIComponent(evidence[1]));return x?json(res,200,x):json(res,404,{error:'evidence_not_found'});}
 if(url.pathname==='/api/truth/entities'&&req.method==='GET')return json(res,200,{items:await Q.listEntities({type:url.searchParams.get('type'),importance:url.searchParams.get('importance'),limit:url.searchParams.get('limit')||100})});
 const entityContext=url.pathname.match(/^\/api\/truth\/entities\/([^/]+)\/context$/);if(entityContext&&req.method==='GET'){const x=await H.relationshipContext(decodeURIComponent(entityContext[1]));return x?json(res,200,x):json(res,404,{error:'entity_not_found'});}
 const entity=url.pathname.match(/^\/api\/truth\/entities\/([^/]+)$/);if(entity&&req.method==='GET'){const x=await Q.entityTruth(decodeURIComponent(entity[1]));return x?json(res,200,x):json(res,404,{error:'entity_not_found'});}
 const addClaim=url.pathname.match(/^\/api\/truth\/entities\/([^/]+)\/claims$/);if(addClaim&&req.method==='POST'){const b=await body(req),ev=await I.recordEvidence({sourceType:'user',sourceRecordId:`correction:${Date.now()}:${decodeURIComponent(addClaim[1])}`,evidenceType:'user_confirmation',payload:{predicate:b.predicate,value:b.value,note:b.note||null},ingestionMethod:'user_correction',confidence:1});const claim=await C.recordClaim({subjectEntityId:decodeURIComponent(addClaim[1]),predicate:b.predicate,value:b.value,truthClass:'USER_CONFIRMED',confidence:1,evidenceIds:[ev.id],validFrom:b.validFrom||null,validUntil:b.validUntil||null,verifiedAt:new Date().toISOString()});await C.blackBox({eventType:'truth.user_confirmed',observation:`User confirmed ${b.predicate}`,confidence:1,evidenceIds:[ev.id]});return json(res,201,{ok:true,claim});}
 const claim=url.pathname.match(/^\/api\/truth\/claims\/([^/]+)$/);if(claim&&req.method==='GET'){const x=await Q.claimTruth(decodeURIComponent(claim[1]));return x?json(res,200,x):json(res,404,{error:'claim_not_found'});}
 const contradict=url.pathname.match(/^\/api\/truth\/claims\/([^/]+)\/contradict$/);if(contradict&&req.method==='POST'){const b=await body(req),ev=await I.recordEvidence({sourceType:'user',sourceRecordId:`contradiction:${Date.now()}:${decodeURIComponent(contradict[1])}`,evidenceType:'user_correction',payload:{reason:b.reason||'User correction'},ingestionMethod:'user_correction',confidence:1});await C.contradictClaim(decodeURIComponent(contradict[1]),ev.id,b.reason||'User correction');return json(res,200,{ok:true,evidenceId:ev.id});}
 if(url.pathname==='/api/truth/review'&&req.method==='GET')return json(res,200,await Q.reviewQueue(url.searchParams.get('limit')||50));
 const ident=url.pathname.match(/^\/api\/truth\/identity\/([^/]+)\/resolve$/);if(ident&&req.method==='POST'){const b=await body(req);return json(res,200,{ok:true,result:await M.safeIdentityDecision(decodeURIComponent(ident[1]),b.decision,user.sub||'tylor',b.rationale||'')});}
 if(url.pathname==='/api/truth/identity/merges'&&req.method==='GET')return json(res,200,{items:await M.mergeSnapshots(url.searchParams.get('limit')||30)});
 const rollback=url.pathname.match(/^\/api\/truth\/identity\/merges\/([^/]+)\/rollback$/);if(rollback&&req.method==='POST')return json(res,200,await M.rollbackMerge(decodeURIComponent(rollback[1]),user.sub||'tylor'));
 if(url.pathname==='/api/truth/conversations'&&req.method==='GET')return json(res,200,{items:await Q.recentConversations(url.searchParams.get('limit')||50)});
 const convContext=url.pathname.match(/^\/api\/truth\/conversations\/([^/]+)\/context$/);if(convContext&&req.method==='GET'){const x=await H.contextPacketForConversation(decodeURIComponent(convContext[1]));return x?json(res,200,x):json(res,404,{error:'conversation_not_found'});}
 const conv=url.pathname.match(/^\/api\/truth\/conversations\/([^/]+)$/);if(conv&&req.method==='GET'){const x=await Q.conversationDetail(decodeURIComponent(conv[1]));return x?json(res,200,x):json(res,404,{error:'conversation_not_found'});}
 if(url.pathname==='/api/truth/recommendations'&&req.method==='GET')return json(res,200,{items:await Q.recommendations(url.searchParams.get('limit')||50)});
 if(url.pathname==='/api/truth/prepared-decisions'&&req.method==='GET')return json(res,200,{items:await H.preparedDecisions(url.searchParams.get('limit')||50)});
 if(url.pathname==='/api/truth/outcomes'&&req.method==='POST')return json(res,201,{ok:true,outcome:await C.recordOutcome(await body(req))});
 if(url.pathname==='/api/truth/black-box'&&req.method==='GET')return json(res,200,{items:await Q.recentBlackBox(url.searchParams.get('limit')||50)});
 if(url.pathname==='/api/truth/jobs'&&req.method==='GET')return json(res,200,{items:await Q.jobs(url.searchParams.get('limit')||50)});
 if(url.pathname==='/api/truth/jobs/run'&&req.method==='POST')return json(res,200,{ok:true,results:await C.processJobs((await body(req)).limit||20)});
 if(url.pathname==='/api/truth/migrate'&&req.method==='POST'){const b=await body(req);return json(res,200,{ok:true,result:await C.migrateLegacy({snapshot:b.snapshot!==false})});}
 if(url.pathname==='/api/truth/history/import'&&req.method==='POST')return json(res,200,{ok:true,result:await H.importLegacyMessages((await body(req)).limit||5000)});
 if(url.pathname==='/api/truth/situations/detect'&&req.method==='POST')return json(res,200,{ok:true,result:await H.detectSituations((await body(req)).limit||100)});
 if(url.pathname==='/api/truth/ingest'&&req.method==='POST')return json(res,201,{ok:true,result:await C.ingestCommunication(await body(req))});
 if(url.pathname==='/api/lab/truth'&&req.method==='POST')return json(res,200,await Q.labRun());
 return false;
}
const KEY='__jarvisTruthHttpV3';
if(!global[KEY]){global[KEY]=true;const original=http.createServer.bind(http);http.createServer=function(listener){return original(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(!(url.pathname.startsWith('/api/truth/')||url.pathname==='/api/lab/truth'))return listener(req,res);const user=requireAuth(req,res);if(!user)return;if(!mutationAllowed(req))return json(res,403,{error:'cross_site_request_rejected'});const handled=await route(req,res,url,user);if(handled===false)return json(res,404,{error:'not_found'});}catch(e){return json(res,e.status||500,{error:e.message||'truth_error'});}});};}
async function bootstrap(){await S.init();await M.ensure();const n=(await S.db().query('SELECT count(*)::int n FROM jarvis_library_migration_snapshots')).rows[0]?.n||0;if(!n){const r=await C.migrateLegacy({snapshot:true});console.log('truth migration bootstrap',r);}else await C.enqueue('LEGACY_SYNC',{}, {priority:20});const hist=await H.importLegacyMessages(10000),sit=await H.detectSituations(250),lab=await Q.labRun();console.log('truth bootstrap',{labScore:lab.score,labPassed:lab.passed,historical:hist,situations:sit});await C.processJobs(30);}
bootstrap().catch(e=>console.error('truth bootstrap failed',String(e.message||e).slice(0,220)));
setInterval(()=>C.processJobs(30).catch(e=>console.error('truth jobs failed',String(e.message||e).slice(0,180))),60000).unref();
setInterval(async()=>{try{await C.enqueue('LEGACY_SYNC',{}, {priority:10});await H.importLegacyMessages(10000);await H.detectSituations(250);}catch(e){console.error('truth maintenance failed',String(e.message||e).slice(0,180));}},300000).unref();
module.exports={route,bootstrap};
