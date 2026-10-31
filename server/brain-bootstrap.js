const {Pool}=require('pg');
const brain=require('./brain');
const decisionEngine=require('./decision-engine');
let running=null;
function pool(){return new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});}
async function ensureHistoricalBackfill(){if(running)return running;running=(async()=>{if(!process.env.DATABASE_URL)return{status:'SOURCE_NEEDED'};await brain.init();await decisionEngine.init();const p=pool();try{const r=await p.query("SELECT payload,updated_at FROM jarvis_brain_state WHERE state_key='historical_backfill'");if(r.rows[0])return{status:'EXISTS',updatedAt:r.rows[0].updated_at,result:r.rows[0].payload,phaseThree:await decisionEngine.phaseThreeStatus()};const result=await brain.backfill({gmailLimit:120,driveLimit:500,days:730});return{status:'CREATED',result,phaseThree:await decisionEngine.phaseThreeStatus()};}finally{await p.end().catch(()=>{});}})();try{return await running}finally{running=null;}}
module.exports={ensureHistoricalBackfill};
