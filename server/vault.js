const crypto=require('crypto');
let pool=null,ready=null;
function key(){const secret=process.env.JARVIS_SESSION_SECRET;if(!secret)throw new Error('vault_key_unavailable');return crypto.createHash('sha256').update(secret).digest();}
async function db(){if(!process.env.DATABASE_URL)throw new Error('postgres_required_for_vault');if(!pool){const {Pool}=require('pg');pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});ready=pool.query(`CREATE TABLE IF NOT EXISTS jarvis_secrets (name text PRIMARY KEY,payload text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())`);}await ready;return pool;}
function encrypt(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});}
function decrypt(payload){const x=JSON.parse(payload);const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(x.iv,'base64'));decipher.setAuthTag(Buffer.from(x.tag,'base64'));const data=Buffer.concat([decipher.update(Buffer.from(x.data,'base64')),decipher.final()]);return JSON.parse(data.toString('utf8'));}
async function setSecret(name,value){const p=await db();await p.query(`INSERT INTO jarvis_secrets(name,payload,updated_at) VALUES($1,$2,now()) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload,updated_at=now()`,[name,encrypt(value)]);}
async function getSecret(name){const p=await db();const r=await p.query('SELECT payload FROM jarvis_secrets WHERE name=$1',[name]);return r.rows.length?decrypt(r.rows[0].payload):null;}
async function deleteSecret(name){const p=await db();await p.query('DELETE FROM jarvis_secrets WHERE name=$1',[name]);}
async function health(){try{const p=await db();await p.query('SELECT 1');return{status:'CONNECTED'}}catch(e){return{status:'ERROR',error:e.message}}}
module.exports={setSecret,getSecret,deleteSecret,health};
