const http=require('http');const fs=require('fs');const path=require('path');
const {requireAuth,session,login,logout}=require('./server/auth');
const engine=require('./server/engine');
const {persistenceHealth}=require('./server/store');
const root=path.join(__dirname,'v3');const port=Number(process.env.PORT||10000);const maxBody=1024*1024;
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
function securityHeaders(){return {'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}}
function json(res,code,obj){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...securityHeaders()});res.end(JSON.stringify(obj))}
function readBody(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>maxBody){reject(Object.assign(new Error('body_too_large'),{status:413}));req.destroy()}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(Object.assign(new Error('invalid_json'),{status:400}))}});req.on('error',reject)})}
function safePath(urlPath){const clean=decodeURIComponent((urlPath||'/').split('?')[0]);const rel=clean==='/'?'index.html':clean.replace(/^\/+/, '');const full=path.normalize(path.join(root,rel));const relCheck=path.relative(root,full);return relCheck.startsWith('..')||path.isAbsolute(relCheck)?null:full}
async function api(req,res,url){
  if(url.pathname==='/api/auth/status'&&req.method==='GET')return json(res,200,{authenticated:Boolean(session(req)),configured:Boolean(process.env.JARVIS_ACCESS_KEY)});
  if(url.pathname==='/api/login'&&req.method==='POST'){const b=await readBody(req);const r=login(req,res,b.password);return json(res,r.ok?200:r.code,r)}
  if(url.pathname==='/api/logout'&&req.method==='POST'){logout(res);return json(res,200,{ok:true})}
  if(url.pathname==='/api/health'&&req.method==='GET'){const memory=await persistenceHealth();return json(res,200,{ok:true,service:'jarvis-v3',version:'3.1.0',time:new Date().toISOString(),render:Boolean(process.env.RENDER||process.env.RENDER_SERVICE_ID),memory:{status:memory.status,kind:memory.kind}})}
  const user=requireAuth(req,res);if(!user)return;
  if(url.pathname==='/api/state'&&req.method==='GET')return json(res,200,await engine.publicState());
  if(url.pathname==='/api/decisions'&&req.method==='POST')return json(res,201,await engine.createDecision(await readBody(req)));
  const decision=url.pathname.match(/^\/api\/decisions\/([^/]+)\/resolve$/);if(decision&&req.method==='POST'){const b=await readBody(req);return json(res,200,await engine.resolveDecision(decision[1],b.option,user.sub))}
  if(url.pathname==='/api/jobs'&&req.method==='POST')return json(res,201,await engine.createJob(await readBody(req)));
  const job=url.pathname.match(/^\/api\/jobs\/([^/]+)$/);if(job&&req.method==='PATCH')return json(res,200,await engine.updateJob(job[1],await readBody(req)));
  if(url.pathname==='/api/sync/calendar'&&req.method==='POST'){const b=await readBody(req);return json(res,200,{events:await engine.syncCalendar(b.events||[])})}
  if(url.pathname==='/api/integrations/failure'&&req.method==='POST'){const b=await readBody(req);return json(res,200,await engine.integrationFailure(b.name,b.message,b.status||'ERROR'))}
  return json(res,404,{error:'not_found'});
}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname.startsWith('/api/'))return await api(req,res,url);const file=safePath(url.pathname);if(!file){res.writeHead(400);return res.end('Bad request')}fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404,{'content-type':'text/plain; charset=utf-8',...securityHeaders()});return res.end('Not found')}const ext=path.extname(file).toLowerCase();res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream','cache-control':'public, max-age=120',...securityHeaders()});fs.createReadStream(file).pipe(res)})}catch(err){console.error(err);if(!res.headersSent)json(res,err.status||500,{error:err.message||'internal_error'})}});
server.listen(port,'0.0.0.0',()=>console.log(`JARVIS V3.1 listening on ${port}`));
