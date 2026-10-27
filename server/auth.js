const crypto=require('crypto');
const COOKIE='jarvis_session';
function key(){const configured=process.env.JARVIS_SESSION_SECRET;if(configured)return configured;if(process.env.RENDER||process.env.NODE_ENV==='production')throw new Error('JARVIS_SESSION_SECRET is required in production');return'dev-only-session-secret-change-me';}
function b64(x){return Buffer.from(x).toString('base64url')}
function sign(payload){const body=b64(JSON.stringify(payload));const sig=crypto.createHmac('sha256',key()).update(body).digest('base64url');return `${body}.${sig}`}
function verify(token){try{const [body,sig]=String(token||'').split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',key()).update(body).digest('base64url');if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;const p=JSON.parse(Buffer.from(body,'base64url'));if(typeof p.sub!=='string'||!p.sub.trim()||!Number.isFinite(Number(p.exp))||Number(p.exp)<=Date.now())return null;return p;}catch{return null}}
function parseCookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf('=');return i>0?[v.slice(0,i),decodeURIComponent(v.slice(i+1))]:['','']} ).filter(([k])=>k))}
function session(req){return verify(parseCookies(req)[COOKIE]||'')}
function requireAuth(req,res){const s=session(req);if(!s){res.writeHead(401,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:'auth_required'}));return null;}return s}
function login(req,res,password){const configured=process.env.JARVIS_ACCESS_KEY;if(!configured)return{ok:false,code:503,error:'auth_not_configured'};const a=Buffer.from(String(password||'')),b=Buffer.from(configured);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return{ok:false,code:401,error:'invalid_credentials'};const token=sign({sub:'tylor',exp:Date.now()+1000*60*60*24*14});res.setHeader('set-cookie',`${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60*60*24*14}`);return{ok:true}}
function logout(res){res.setHeader('set-cookie',`${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`)}
module.exports={requireAuth,session,login,logout};
