const crypto=require('crypto');
const {Pool}=require('pg');

const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}
});

function hashToken(token){return crypto.createHash('sha256').update(String(token||'')).digest('hex')}
function cleanNumber(v,min,max){
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v); if(!Number.isFinite(n)||n<min||n>max)return null; return n;
}

async function init(){
  await pool.query(`
    create table if not exists jarvis_wearable_devices(
      id bigserial primary key,
      label text not null default 'JARVIS Companion',
      token_hash text not null unique,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz,
      revoked_at timestamptz
    );
    create table if not exists jarvis_wearable_snapshots(
      id bigserial primary key,
      device_id bigint not null references jarvis_wearable_devices(id) on delete cascade,
      source text not null,
      captured_at timestamptz not null,
      received_at timestamptz not null default now(),
      metrics jsonb not null
    );
    create index if not exists jarvis_wearable_snapshots_device_time_idx
      on jarvis_wearable_snapshots(device_id,captured_at desc);
  `);
}

async function createPairing(label='JARVIS Companion'){
  const token=crypto.randomBytes(24).toString('base64url');
  const tokenHash=hashToken(token);
  const result=await pool.query(
    'insert into jarvis_wearable_devices(label,token_hash) values($1,$2) returning id,label,created_at',
    [String(label||'JARVIS Companion').slice(0,80),tokenHash]
  );
  return {device:result.rows[0],token};
}

async function deviceForBearer(header){
  const raw=String(header||'').replace(/^Bearer\s+/i,'').trim();
  if(!raw)return null;
  const result=await pool.query(
    'select id,label,created_at,last_seen_at from jarvis_wearable_devices where token_hash=$1 and revoked_at is null limit 1',
    [hashToken(raw)]
  );
  return result.rows[0]||null;
}

function normalize(body={}){
  const m=body.metrics||{};
  const capturedAt=new Date(body.capturedAt||Date.now());
  if(Number.isNaN(capturedAt.getTime()))throw Object.assign(new Error('invalid_captured_at'),{status:400});
  const source=['health_connect','fitcloud'].includes(body.source)?body.source:'health_connect';
  const metrics={
    steps:cleanNumber(m.steps,0,500000),
    heartRateBpm:cleanNumber(m.heartRateBpm,20,260),
    sleepMinutes:cleanNumber(m.sleepMinutes,0,1440),
    caloriesKcal:cleanNumber(m.caloriesKcal,0,20000),
    distanceMeters:cleanNumber(m.distanceMeters,0,500000),
    oxygenPercent:cleanNumber(m.oxygenPercent,50,100),
    weightKg:cleanNumber(m.weightKg,20,500)
  };
  return {source,capturedAt:capturedAt.toISOString(),metrics};
}

async function ingest(device,body){
  const snap=normalize(body);
  const result=await pool.query(
    'insert into jarvis_wearable_snapshots(device_id,source,captured_at,metrics) values($1,$2,$3,$4) returning id,source,captured_at,received_at,metrics',
    [device.id,snap.source,snap.capturedAt,snap.metrics]
  );
  await pool.query('update jarvis_wearable_devices set last_seen_at=now() where id=$1',[device.id]);
  return result.rows[0];
}

async function latest(){
  const result=await pool.query(`
    select s.id,s.source,s.captured_at,s.received_at,s.metrics,d.id as device_id,d.label,d.last_seen_at
    from jarvis_wearable_snapshots s
    join jarvis_wearable_devices d on d.id=s.device_id
    where d.revoked_at is null
    order by s.captured_at desc limit 1
  `);
  return result.rows[0]||null;
}

async function status(){
  const devices=await pool.query('select id,label,created_at,last_seen_at,revoked_at from jarvis_wearable_devices order by created_at desc limit 10');
  const last=await latest();
  return {
    connectionState:last?'CONNECTED':'NOT_CONNECTED',
    latest:last,
    devices:devices.rows.map(d=>({...d,token:undefined}))
  };
}

async function revoke(id){
  await pool.query('update jarvis_wearable_devices set revoked_at=now() where id=$1',[Number(id)]);
  return {ok:true};
}

module.exports={init,createPairing,deviceForBearer,ingest,latest,status,revoke};
