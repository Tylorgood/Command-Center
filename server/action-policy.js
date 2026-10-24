const crypto=require('crypto');
let pool=null,ready=null;
function db(){if(!process.env.DATABASE_URL)throw Object.assign(new Error('action_policy_database_unavailable'),{code:'SOURCE_NEEDED'});if(!pool){const{Pool}=require('pg');pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});}return pool;}
function stable(prefix,v){return `${prefix}_${crypto.createHash('sha256').update(String(v)).digest('hex').slice(0,24)}`;}
async function init(){if(!ready)ready=db().query(`
CREATE TABLE IF NOT EXISTS jarvis_action_decisions(
 id text PRIMARY KEY,action_type text NOT NULL,subject text,risk text NOT NULL,reversible boolean NOT NULL,
 confidence real NOT NULL,policy_mode text NOT NULL,capability text NOT NULL DEFAULT 'UNKNOWN',reason text,
 context jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS jarvis_action_decisions_created_idx ON jarvis_action_decisions(created_at DESC);
CREATE TABLE IF NOT EXISTS jarvis_action_outcomes(
 id bigserial PRIMARY KEY,action_decision_id text REFERENCES jarvis_action_decisions(id) ON DELETE SET NULL,
 outcome text NOT NULL,detail jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now());
`);return ready;}
const ALWAYS_APPROVAL=new Set(['send_message','send_email','delete_file','delete_email','transfer_money','purchase','cancel_service','change_medication','medical_decision','legal_commitment','employment_commitment','accept_offer','decline_offer','publish_publicly']);
const NEVER_AUTOMATE=new Set(['transfer_money','purchase','change_medication','medical_decision','legal_commitment','employment_commitment','accept_offer','decline_offer']);
const SAFE_PREPARE=new Set(['draft_message','draft_email','prepare_attachment','prepare_calendar_change','summarize_context','find_file','create_internal_reminder','classify_signal','link_context']);
function normalizeRisk(v='LOW'){v=String(v).toUpperCase();return['LOW','MEDIUM','HIGH','CRITICAL'].includes(v)?v:'MEDIUM';}
function clamp(v){v=Number(v);return Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;}
function evaluate(input={}){const actionType=String(input.actionType||'').toLowerCase(),confidence=clamp(input.confidence),risk=normalizeRisk(input.risk),reversible=input.reversible!==false,history=input.history||{},approved=Number(history.approved||0),edited=Number(history.edited||0),rejected=Number(history.rejected||0),capability=String(input.capability||'UNKNOWN').toUpperCase();let mode='SUGGEST',reason='Insufficient evidence for higher autonomy';if(NEVER_AUTOMATE.has(actionType)){mode='ASK';reason='High-consequence category is permanently human-approved';}
else if(ALWAYS_APPROVAL.has(actionType)){mode=confidence>=.75?'ASK':'SUGGEST';reason='External or irreversible action requires explicit approval';}
else if(SAFE_PREPARE.has(actionType)){if(confidence>=.8)mode='PREPARE';else mode='SUGGEST';reason=mode==='PREPARE'?'Low-risk preparation can happen without external side effects':'Preparation confidence below threshold';}
else if(reversible&&risk==='LOW'&&confidence>=.96&&approved>=10&&edited<=2&&rejected===0){mode='ACT';reason='Reversible low-risk action has strong confidence and repeated approval history';}
else if(reversible&&risk==='LOW'&&confidence>=.85){mode='PREPARE';reason='Low-risk reversible action can be prepared, but evidence is not strong enough for autonomous execution';}
else if(confidence>=.7){mode='ASK';reason='Action has enough evidence to propose but should remain approval-gated';}
if(mode==='ACT'&&capability!=='AVAILABLE'){mode='PREPARE';reason='Policy permits autonomous action, but execution capability is not currently available';}
return{actionType,mode,risk,reversible,confidence,capability,reason,history:{approved,edited,rejected},guardrails:{alwaysApproval:ALWAYS_APPROVAL.has(actionType),neverAutomate:NEVER_AUTOMATE.has(actionType)}};}
async function recordDecision(input={}){await init();const decision=evaluate(input),id=stable('act',`${Date.now()}:${decision.actionType}:${input.subject||''}:${Math.random()}`);await db().query(`INSERT INTO jarvis_action_decisions(id,action_type,subject,risk,reversible,confidence,policy_mode,capability,reason,context) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,[id,decision.actionType,input.subject||null,decision.risk,decision.reversible,decision.confidence,decision.mode,decision.capability,decision.reason,JSON.stringify(input.context||{})]);return{id,...decision};}
async function proposeForSituation(s={}){const source=String(s.data?.sourceType||'').toLowerCase();if(source==='gmail'&&s.status==='WAITING_ON_ME')return evaluate({actionType:'draft_email',subject:s.title,confidence:Number(s.confidence||.8),risk:'LOW',reversible:true,capability:'AVAILABLE'});if(source==='calendar')return evaluate({actionType:'summarize_context',subject:s.title,confidence:Number(s.confidence||1),risk:'LOW',reversible:true,capability:'AVAILABLE'});return evaluate({actionType:'summarize_context',subject:s.title,confidence:Number(s.confidence||.7),risk:'LOW',reversible:true,capability:'AVAILABLE'});}
async function labRun(){await init();const cases=[
{name:'draft recruiter reply',input:{actionType:'draft_email',confidence:.94,risk:'LOW',reversible:true,capability:'AVAILABLE'},expect:'PREPARE'},
{name:'send recruiter reply',input:{actionType:'send_email',confidence:.98,risk:'LOW',reversible:false,capability:'AVAILABLE'},expect:'ASK'},
{name:'find resume file',input:{actionType:'find_file',confidence:.93,risk:'LOW',reversible:true,capability:'AVAILABLE'},expect:'PREPARE'},
{name:'summarize meeting context',input:{actionType:'summarize_context',confidence:.99,risk:'LOW',reversible:true,capability:'AVAILABLE'},expect:'PREPARE'},
{name:'transfer money',input:{actionType:'transfer_money',confidence:.99,risk:'HIGH',reversible:false,capability:'AVAILABLE'},expect:'ASK'},
{name:'medical decision',input:{actionType:'medical_decision',confidence:.99,risk:'CRITICAL',reversible:false,capability:'AVAILABLE'},expect:'ASK'},
{name:'employment acceptance',input:{actionType:'accept_offer',confidence:.99,risk:'HIGH',reversible:false,capability:'AVAILABLE'},expect:'ASK'},
{name:'mature reversible automation',input:{actionType:'mark_internal_state',confidence:.98,risk:'LOW',reversible:true,capability:'AVAILABLE',history:{approved:18,edited:1,rejected:0}},expect:'ACT'},
{name:'capability gate',input:{actionType:'mark_internal_state',confidence:.98,risk:'LOW',reversible:true,capability:'UNAVAILABLE',history:{approved:18,edited:1,rejected:0}},expect:'PREPARE'},
{name:'low confidence preparation',input:{actionType:'draft_email',confidence:.55,risk:'LOW',reversible:true,capability:'AVAILABLE'},expect:'SUGGEST'}
];const results=cases.map(c=>{const actual=evaluate(c.input);return{name:c.name,expected:c.expect,actual:actual.mode,passed:actual.mode===c.expect,reason:actual.reason};});const score=Math.round(results.filter(x=>x.passed).length/results.length*100);return{lab:'JARVIS Action Policy',score,passed:score===100,tests:results,principle:'No external or high-consequence action is auto-executed merely because model confidence is high.'};}
module.exports={init,evaluate,recordDecision,proposeForSituation,labRun};
