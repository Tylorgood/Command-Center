const {Pool}=require('pg');
const brain=require('./brain');
const decisionEngine=require('./decision-engine');
const heartbeat=require('./heartbeat-engine');
const heartbeatView=require('./heartbeat-view');
const worldRefresh=require('./world-refresh');
const worldEngine=require('./world-engine');
let running=null,heartbeatTimer=null;
function pool(){return new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});}
async function prepareActiveDecisions(p){const rows=(await p.query(`SELECT s.id FROM jarvis_situations s WHERE s.status NOT IN ('RESOLVED','ARCHIVED') AND NOT EXISTS(SELECT 1 FROM jarvis_prepared_decisions d WHERE d.situation_id=s.id AND d.status='PREPARED') ORDER BY CASE s.priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,s.last_seen_at DESC LIMIT 5`)).rows;let prepared=0,errors=0;for(const row of rows){try{await decisionEngine.prepareDecision({situationId:row.id});prepared++;}catch{errors++;}}return{scanned:rows.length,prepared,errors};}
function startHeartbeat(){if(heartbeatTimer||!process.env.DATABASE_URL)return false;const tick=async()=>{try{const r=await heartbeat.run('internal_10m');const worlds=await worldRefresh.refresh();const living=await worldEngine.reconcileRecent();const view=await heartbeatView.sync();console.log('JARVIS heartbeat',{status:r.status,id:r.id,decisions:r.decisionsPrepared,published:view.synced,worlds,living})}catch(e){console.error('JARVIS heartbeat failed',String(e.message||e).slice(0,240))}};setTimeout(tick,15000);heartbeatTimer=setInterval(tick,10*60*1000);return true;}
async function ensureHistoricalBackfill(){if(running)return running;running=(async()=>{if(!process.env.DATABASE_URL)return{status:'SOURCE_NEEDED'};await brain.init();await decisionEngine.init();const p=pool();try{const r=await p.query("SELECT payload,updated_at FROM jarvis_brain_state WHERE state_key='historical_backfill'");let status='EXISTS',result=r.rows[0]?.payload||null,updatedAt=r.rows[0]?.updated_at||null;if(!r.rows[0]){result=await brain.backfill({gmailLimit:120,driveLimit:500,days:730});status='CREATED';}const decisions=await prepareActiveDecisions(p);startHeartbeat();return{status,updatedAt,result,phaseThree:await decisionEngine.phaseThreeStatus(),decisions,heartbeat:{started:Boolean(heartbeatTimer),intervalMinutes:10}};}finally{await p.end().catch(()=>{});}})();try{return await running}finally{running=null;}}
module.exports={ensureHistoricalBackfill,prepareActiveDecisions,startHeartbeat};
