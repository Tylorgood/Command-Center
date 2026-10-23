const http=require('http');const fs=require('fs');const path=require('path');const vm=require('vm');
const {requireAuth,session,login,logout}=require('./server/auth');
const engine=require('./server/engine');
const dashboard=require('./server/dashboard');
const google=require('./server/google');
const {persistenceProof,recordBoot}=require('./server/store');
const v3Root=path.join(__dirname,'v3');const v4Root=path.join(__dirname,'v4');const port=Number(process.env.PORT||10000);const maxBody=1024*1024;
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
function securityHeaders(){return {'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}}
function json(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...securityHeaders()});res.end(JSON.stringify(obj))}
function redirect(res,location){res.writeHead(302,{location,'cache-control':'no-store',...securityHeaders()});res.end()}
function readBody(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>maxBody){reject(Object.assign(new Error('body_too_large'),{status:413}));req.destroy()}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(Object.assign(new Error('invalid_json'),{status:400}))}});req.on('error',reject)})}
function safePath(root,urlPath){const clean=decodeURIComponent((urlPath||'/').split('?')[0]);const rel=clean==='/'?'index.html':clean.replace(/^\/+/, '');const full=path.normalize(path.join(root,rel));const relCheck=path.relative(root,full);return relCheck.startsWith('..')||path.isAbsolute(relCheck)?null:full}
function serveStatic(res,root,urlPath){const file=safePath(root,urlPath);if(!file){res.writeHead(400);return res.end('Bad request')}fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404,{'content-type':'text/plain; charset=utf-8',...securityHeaders()});return res.end('Not found')}const ext=path.extname(file).toLowerCase();res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream','cache-control':'public, max-age=60',...securityHeaders()});fs.createReadStream(file).pipe(res)})}
function mutationAllowed(req){if(['GET','HEAD','OPTIONS'].includes(req.method))return true;if(String(req.headers['sec-fetch-site']||'').toLowerCase()==='cross-site')return false;const origin=req.headers.origin;if(!origin)return true;try{const u=new URL(origin);return u.host===req.headers.host&&u.protocol==='https:';}catch{return false}}
async function api(req,res,url){
  if(url.pathname==='/api/auth/status'&&req.method==='GET')return json(res,200,{authenticated:Boolean(session(req)),configured:Boolean(process.env.JARVIS_ACCESS_KEY)});
  if(url.pathname==='/api/login'&&req.method==='POST'){if(!mutationAllowed(req))return json(res,403,{error:'cross_site_request_rejected'});const b=await readBody(req);const r=login(req,res,b.password);return json(res,r.ok?200:r.code,r)}
  if(url.pathname==='/api/logout'&&req.method==='POST'){if(!mutationAllowed(req))return json(res,403,{error:'cross_site_request_rejected'});logout(res);return json(res,200,{ok:true})}
  if(url.pathname==='/api/health'&&req.method==='GET'){const memory=await persistenceProof();return json(res,200,{ok:true,service:'jarvis-v3',version:'4-preview',time:new Date().toISOString(),render:Boolean(process.env.RENDER||process.env.RENDER_SERVICE_ID),memory})}
  if(url.pathname==='/api/google/callback'&&req.method==='GET'){
    try{const code=url.searchParams.get('code'),state=url.searchParams.get('state');console.log('google oauth callback received',{hasCode:Boolean(code),hasState:Boolean(state),error:url.searchParams.get('error')||null});if(!code)throw Object.assign(new Error(url.searchParams.get('error')||'google_code_missing'),{status:400});await google.exchangeCode(code,state);console.log('google oauth token stored');return redirect(res,'/?google=connected')}catch(err){console.error('google oauth callback failed',String(err.message||'oauth_failed').slice(0,160));return redirect(res,`/?google=error&reason=${encodeURIComponent('oauth_failed')}`)}
  }
  const user=requireAuth(req,res);if(!user)return;if(!mutationAllowed(req))return json(res,403,{error:'cross_site_request_rejected'});
  if(url.pathname==='/api/google/status'&&req.method==='GET')return json(res,200,{...(await google.status()),redirectUri:google.redirectUri()});
  if(url.pathname==='/api/google/start'&&req.method==='GET'){console.log('google oauth start',{sub:user.sub||'tylor'});const authUrl=google.authorizationUrl(user);if(url.searchParams.get('json')==='1')return json(res,200,{url:authUrl});return redirect(res,authUrl)}
  if(url.pathname==='/api/state'&&req.method==='GET')return json(res,200,await dashboard.publicState());
  if(url.pathname==='/api/dashboard'&&req.method==='GET')return json(res,200,await dashboard.cockpitState());
  if(url.pathname==='/api/decisions'&&req.method==='POST')return json(res,201,await engine.createDecision(await readBody(req)));
  const decision=url.pathname.match(/^\/api\/decisions\/([^/]+)\/resolve$/);if(decision&&req.method==='POST'){const b=await readBody(req);return json(res,200,await engine.resolveDecision(decision[1],b.option,user.sub))}
  if(url.pathname==='/api/jobs'&&req.method==='POST')return json(res,201,await engine.createJob(await readBody(req)));
  const job=url.pathname.match(/^\/api\/jobs\/([^/]+)$/);if(job&&req.method==='PATCH')return json(res,200,await engine.updateJob(job[1],await readBody(req)));
  if(url.pathname==='/api/sync/calendar'&&req.method==='POST'){const b=await readBody(req);return json(res,200,{events:await engine.syncCalendar(b.events||[])})}
  if(url.pathname==='/api/integrations/failure'&&req.method==='POST'){const b=await readBody(req);return json(res,200,await engine.integrationFailure(b.name,b.message,b.status||'ERROR'))}
  return json(res,404,{error:'not_found'});
}
function validateV4Assets(){for(const name of ['index.html','styles.css','app.js']){const file=path.join(v4Root,name);if(!fs.existsSync(file))throw new Error(`missing V4 asset: ${name}`)}new vm.Script(fs.readFileSync(path.join(v4Root,'app.js'),'utf8'),{filename:'v4/app.js'});}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname.startsWith('/api/'))return await api(req,res,url);if(url.pathname==='/v4')return redirect(res,'/v4/');if(url.pathname.startsWith('/v4/'))return serveStatic(res,v4Root,url.pathname.slice(3)||'/');return serveStatic(res,v3Root,url.pathname)}catch(err){console.error(err);if(!res.headersSent)json(res,err.status||500,{error:err.message||'internal_error'})}});
(async()=>{try{validateV4Assets();await recordBoot()}catch(err){console.error('startup validation failed',err.message);process.exitCode=1;return}server.listen(port,'0.0.0.0',()=>console.log(`JARVIS V4 preview + V3 fallback listening on ${port}`))})();
