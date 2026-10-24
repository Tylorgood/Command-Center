const http=require('http');
const school=require('./message-school');
const cheatsheet=require('./message-cheatsheet');
const {requireAuth}=require('./auth');
const PREDICT_KEY='__jarvisMessageSchoolCheatsheetPredictV2';
if(!global[PREDICT_KEY]){
 global[PREDICT_KEY]=true;
 const basePredict=school.predict.bind(school);
 const baseTestQueue=school.testQueue.bind(school);
 school.predict=async function(ex){return cheatsheet.applyPrediction(await basePredict(ex),ex);};
 school.testQueue=async function(limit){const q=await baseTestQueue(limit);if(q&&Array.isArray(q.items)){for(const item of q.items)item.prediction=await cheatsheet.applyPrediction(item.prediction||{},item);}return q;};
}
const shadow=require('./message-school-shadow');
function reply(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});res.end(JSON.stringify(obj));}
function html(res,code,text){res.writeHead(code,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"});res.end(text);}
function body(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>256000){reject(Object.assign(new Error('body_too_large'),{status:413}));req.destroy();}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(Object.assign(new Error('invalid_json'),{status:400}));}});req.on('error',reject);});}
function mutationAllowed(req){if(['GET','HEAD','OPTIONS'].includes(req.method))return true;if(String(req.headers['sec-fetch-site']||'').toLowerCase()==='cross-site')return false;const origin=req.headers.origin;if(!origin)return true;try{const u=new URL(origin);return u.host===req.headers.host&&u.protocol==='https:'}catch{return false}}
function profilePage(){return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>JARVIS Message Cheat Sheet</title><style>body{font-family:system-ui;background:#0b0d10;color:#e8edf2;max-width:760px;margin:40px auto;padding:20px}textarea{width:100%;height:420px;background:#151a20;color:#e8edf2;border:1px solid #36404a;border-radius:8px;padding:12px;box-sizing:border-box}button{margin-top:12px;margin-right:8px;padding:10px 18px;border:0;border-radius:8px;font-weight:700}pre{white-space:pre-wrap;background:#151a20;padding:12px;border-radius:8px}</style></head><body><h1>JARVIS Message Cheat Sheet</h1><p>Private profile data is stored in JARVIS Postgres, not GitHub.</p><textarea id="profile" placeholder="Paste profile JSON here"></textarea><br><button id="save">Save private profile</button><button id="exam">Run shadow exam</button><pre id="status">Ready.</pre><script>const s=document.getElementById('status');document.getElementById('save').onclick=async()=>{try{const data=JSON.parse(document.getElementById('profile').value);const r=await fetch('/api/message-school/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const j=await r.json();s.textContent=JSON.stringify(j,null,2);}catch(e){s.textContent='Error: '+e.message;}};document.getElementById('exam').onclick=async()=>{s.textContent='Running shadow exam...';try{const r=await fetch('/api/message-school/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});const j=await r.json();s.textContent=JSON.stringify(j,null,2);}catch(e){s.textContent='Error: '+e.message;}};</script></body></html>`;}
const PATCH_KEY='__jarvisMessageSchoolHttpPatchedV6';
if(!global[PATCH_KEY]){
 global[PATCH_KEY]=true;
 const original=http.createServer.bind(http);
 http.createServer=function(listener){return original(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);const isPage=url.pathname==='/message-school/cheatsheet';const isApi=url.pathname.startsWith('/api/message-school/');if(!isPage&&!isApi)return listener(req,res);const user=requireAuth(req,res);if(!user)return;if(!mutationAllowed(req))return reply(res,403,{error:'cross_site_request_rejected'});if(isPage&&req.method==='GET')return html(res,200,profilePage());
 if(url.pathname==='/api/message-school/profile'&&req.method==='GET')return reply(res,200,await cheatsheet.summary());
 if(url.pathname==='/api/message-school/profile'&&req.method==='POST')return reply(res,200,await cheatsheet.saveProfile(await body(req)));
 if(url.pathname==='/api/message-school/train'&&req.method==='POST')return reply(res,200,await school.train());
 if(url.pathname==='/api/message-school/test'&&req.method==='GET')return reply(res,200,await school.testQueue(url.searchParams.get('limit')||20));
 if(url.pathname==='/api/message-school/evaluate'&&req.method==='POST')return reply(res,200,await shadow.evaluate());
 const feedback=url.pathname.match(/^\/api\/message-school\/test\/([^/]+)\/feedback$/);if(feedback&&req.method==='POST')return reply(res,200,await school.feedback(decodeURIComponent(feedback[1]),await body(req)));
 const reveal=url.pathname.match(/^\/api\/message-school\/test\/([^/]+)\/reveal$/);if(reveal&&req.method==='GET'){const x=await school.reveal(decodeURIComponent(reveal[1]));return x?reply(res,200,x):reply(res,404,{error:'message_test_case_not_found'});}
 return reply(res,404,{error:'not_found'});}catch(e){if(req.url&&(String(req.url).startsWith('/api/message-school/')||String(req.url).startsWith('/message-school/')))return reply(res,e.status||500,{error:e.message||'message_school_error'});return listener(req,res);}});};
}
const BOOT_KEY='__jarvisMessageSchoolBootV6';
if(!global[BOOT_KEY]){
 global[BOOT_KEY]=true;
 Promise.all([school.init(),cheatsheet.init()]).then(()=>setTimeout(async()=>{try{const r=await school.train();console.log('message school prepared',{examples:r.examples,paired:r.paired,test:r.test,train:r.train,sourceMessages:r.sourceMessages});const exam=await shadow.evaluate();console.log('message school shadow exam',{score:exam.score,count:exam.count,wordingSampleCount:exam.wordingSampleCount,decisionAccuracy:exam.decisionAccuracy,classAccuracy:exam.classAccuracy,draftCoverage:exam.draftCoverage,avgReplySimilarity:exam.avgReplySimilarity,avgStyleScore:exam.avgStyleScore,cases:exam.cases.map(x=>({id:x.id,decisionCorrect:x.decisionCorrect,classCorrect:x.classCorrect,replySimilarity:x.replySimilarity,styleScore:x.styleScore,predictedRespond:x.predictedRespond,historicallyResponded:x.historicallyResponded,attention:x.attention}))});}catch(e){console.error('message school prepare/evaluate failed',String(e.message||e).slice(0,220));}},6000)).catch(e=>console.error('message school init failed',String(e.message||e).slice(0,180)));
}