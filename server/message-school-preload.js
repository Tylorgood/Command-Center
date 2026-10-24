const http=require('http');
const school=require('./message-school');
const shadow=require('./message-school-shadow');
const {requireAuth}=require('./auth');
function reply(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});res.end(JSON.stringify(obj));}
function body(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>256000){reject(Object.assign(new Error('body_too_large'),{status:413}));req.destroy();}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(Object.assign(new Error('invalid_json'),{status:400}));}});req.on('error',reject);});}
function mutationAllowed(req){if(['GET','HEAD','OPTIONS'].includes(req.method))return true;if(String(req.headers['sec-fetch-site']||'').toLowerCase()==='cross-site')return false;const origin=req.headers.origin;if(!origin)return true;try{const u=new URL(origin);return u.host===req.headers.host&&u.protocol==='https:'}catch{return false}}
const PATCH_KEY='__jarvisMessageSchoolHttpPatchedV3';
if(!global[PATCH_KEY]){
 global[PATCH_KEY]=true;
 const original=http.createServer.bind(http);
 http.createServer=function(listener){return original(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(!url.pathname.startsWith('/api/message-school/'))return listener(req,res);const user=requireAuth(req,res);if(!user)return;if(!mutationAllowed(req))return reply(res,403,{error:'cross_site_request_rejected'});
 if(url.pathname==='/api/message-school/train'&&req.method==='POST')return reply(res,200,await school.train());
 if(url.pathname==='/api/message-school/test'&&req.method==='GET')return reply(res,200,await school.testQueue(url.searchParams.get('limit')||20));
 if(url.pathname==='/api/message-school/evaluate'&&req.method==='POST')return reply(res,200,await shadow.evaluate());
 const feedback=url.pathname.match(/^\/api\/message-school\/test\/([^/]+)\/feedback$/);if(feedback&&req.method==='POST')return reply(res,200,await school.feedback(decodeURIComponent(feedback[1]),await body(req)));
 const reveal=url.pathname.match(/^\/api\/message-school\/test\/([^/]+)\/reveal$/);if(reveal&&req.method==='GET'){const x=await school.reveal(decodeURIComponent(reveal[1]));return x?reply(res,200,x):reply(res,404,{error:'message_test_case_not_found'});}
 return reply(res,404,{error:'not_found'});}catch(e){if(req.url&&String(req.url).startsWith('/api/message-school/'))return reply(res,e.status||500,{error:e.message||'message_school_error'});return listener(req,res);}});};
}
const BOOT_KEY='__jarvisMessageSchoolBootV3';
if(!global[BOOT_KEY]){
 global[BOOT_KEY]=true;
 school.init().then(()=>setTimeout(async()=>{try{const r=await school.train();console.log('message school prepared',{examples:r.examples,paired:r.paired,test:r.test,train:r.train,sourceMessages:r.sourceMessages});const exam=await shadow.evaluate();console.log('message school shadow exam',{score:exam.score,count:exam.count,wordingSampleCount:exam.wordingSampleCount,decisionAccuracy:exam.decisionAccuracy,classAccuracy:exam.classAccuracy,draftCoverage:exam.draftCoverage,avgReplySimilarity:exam.avgReplySimilarity,avgStyleScore:exam.avgStyleScore,cases:exam.cases.map(x=>({id:x.id,decisionCorrect:x.decisionCorrect,classCorrect:x.classCorrect,replySimilarity:x.replySimilarity,styleScore:x.styleScore,predictedRespond:x.predictedRespond,historicallyResponded:x.historicallyResponded,attention:x.attention}))});}catch(e){console.error('message school prepare/evaluate failed',String(e.message||e).slice(0,220));}},6000)).catch(e=>console.error('message school init failed',String(e.message||e).slice(0,180)));
}