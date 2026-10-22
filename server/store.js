const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_FILE = process.env.JARVIS_STATE_FILE || path.join(process.cwd(), '.runtime', 'jarvis-state.json');
let pgPool = null;

function iso(){ return new Date().toISOString(); }
function id(prefix='id'){ return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`; }

function seedState(){
  const now = iso();
  return {
    meta: { version: '3.1.0', createdAt: now, updatedAt: now, persistence: 'initializing' },
    preferences: { timezone: 'America/Detroit', displayName: 'Tylor' },
    missions: [
      {id:'jarvis',name:'JARVIS',objective:'Build a truthful personal operating system that observes, understands, decides, acts, and remembers.',state:'ACTIVE BUILD',currentFocus:'V3.1 nervous system',updatedAt:now},
      {id:'freecnc',name:'FREECNC',objective:'Restore FreeCNC and develop the CAM/toolpath conversion product.',state:'ACTIVE',currentFocus:'Product and deployment recovery',updatedAt:now},
      {id:'career',name:'CAREER',objective:'Find and advance strong CNC/CAM/manufacturing opportunities.',state:'MONITORING',currentFocus:'Opportunities and follow-ups',updatedAt:now},
      {id:'music',name:'MUSIC',objective:'Develop and release music and This Moment Studio work.',state:'ACTIVE',currentFocus:'Creative development',updatedAt:now},
      {id:'home',name:'HOME',objective:'Keep home, vehicles, errands, and recurring life operations under control.',state:'STABLE',currentFocus:'Routine operations',updatedAt:now}
    ],
    decisions: [], jobs: [], calendar: [],
    events: [{id:'LIFE-20261022-JV31',type:'system_build',missionId:'jarvis',source:'github',actor:'jarvis',summary:'JARVIS V3.1 nervous-system implementation initialized.',why:'Approved V3.1 build order.',result:'started',createdAt:now}],
    integrations: {
      calendar:{name:'Calendar',status:'AUTH_REQUIRED',lastCheckedAt:now,lastSuccessAt:null,lastError:'Live server-side Calendar connector not configured yet.',details:'Calendar data is not assumed.'},
      gmail:{name:'Gmail',status:'AUTH_REQUIRED',lastCheckedAt:now,lastSuccessAt:null,lastError:'Live server-side Gmail connector not configured yet.',details:'No inbox data is exposed.'},
      drive:{name:'Drive',status:'AUTH_REQUIRED',lastCheckedAt:now,lastSuccessAt:null,lastError:'Live server-side Drive connector not configured yet.',details:'No private Drive data is exposed.'},
      github:{name:'GitHub',status:'UNKNOWN',lastCheckedAt:null,lastSuccessAt:null,lastError:null,details:'Waiting for first server health check.'},
      render:{name:'Render',status:process.env.RENDER ? 'CONNECTED':'UNKNOWN',lastCheckedAt:now,lastSuccessAt:process.env.RENDER?now:null,lastError:null,details:process.env.RENDER?'Running inside Render.':'Render runtime not detected.'},
      persistence:{name:'Memory',status:'UNKNOWN',lastCheckedAt:now,lastSuccessAt:null,lastError:null,details:'Persistence adapter initializing.'}
    }
  };
}

async function createPgAdapter(){
  if(!process.env.DATABASE_URL) return null;
  const { Pool } = require('pg');
  pgPool = new Pool({connectionString:process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : {rejectUnauthorized:false}});
  await pgPool.query(`CREATE TABLE IF NOT EXISTS jarvis_state (singleton boolean PRIMARY KEY DEFAULT true,payload jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())`);
  return {
    kind:'postgres',
    async load(){const r=await pgPool.query('SELECT payload FROM jarvis_state WHERE singleton=true');if(!r.rows.length){const s=seedState();await this.save(s);return s;}return r.rows[0].payload;},
    async save(state){state.meta={...state.meta,updatedAt:iso(),persistence:'postgres'};await pgPool.query(`INSERT INTO jarvis_state(singleton,payload,updated_at) VALUES(true,$1::jsonb,now()) ON CONFLICT(singleton) DO UPDATE SET payload=excluded.payload, updated_at=now()`,[JSON.stringify(state)]);return state;},
    async ping(){await pgPool.query('SELECT 1');return true;}
  };
}

async function createFileAdapter(){
  const dir=path.dirname(DEFAULT_FILE);await fs.mkdir(dir,{recursive:true});
  return {
    kind:'file-degraded',
    async load(){try{return JSON.parse(await fs.readFile(DEFAULT_FILE,'utf8'));}catch{const s=seedState();await this.save(s);return s;}},
    async save(state){state.meta={...state.meta,updatedAt:iso(),persistence:'file-degraded'};const tmp=`${DEFAULT_FILE}.tmp`;await fs.writeFile(tmp,JSON.stringify(state,null,2));await fs.rename(tmp,DEFAULT_FILE);return state;},
    async ping(){await fs.access(DEFAULT_FILE);return true;}
  };
}

let adapterPromise;
async function adapter(){if(!adapterPromise)adapterPromise=(async()=>{try{const pg=await createPgAdapter();if(pg)return pg;}catch(err){console.error('postgres init failed',err.message);}return createFileAdapter();})();return adapterPromise;}
async function load(){return (await adapter()).load();}
async function save(state){return (await adapter()).save(state);}
async function persistenceHealth(){const a=await adapter();try{await a.ping();return{status:a.kind==='postgres'?'CONNECTED':'STALE',kind:a.kind,error:null};}catch(e){return{status:'ERROR',kind:a.kind,error:e.message};}}
module.exports={load,save,persistenceHealth,seedState,id,iso};
