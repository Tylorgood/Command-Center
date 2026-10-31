'use strict';

const crypto=require('crypto');
const knowledge=require('./knowledge');

let pool=null,ready=null;
const ENTITY_TYPES=new Set(['PERSON','ORGANIZATION','SERVICE','PLACE','PROJECT','DEVICE','ACCOUNT','UNKNOWN_ENTITY']);
const TRUTH_CLASSES=new Set(['USER_CONFIRMED','SOURCE_VERIFIED','STRONG_INFERENCE','WEAK_INFERENCE','UNKNOWN','CONTRADICTED','STALE']);
const IDENTITY_STATES={AUTO_MERGE:.95,LIKELY_MATCH:.75,POSSIBLE_MATCH:.40};

function db(){
  if(!process.env.DATABASE_URL) throw Object.assign(new Error('truth_database_unavailable'),{code:'SOURCE_NEEDED'});
  if(!pool){const{Pool}=require('pg');pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});}
  return pool;
}
function stableId(prefix,...parts){return prefix+'_'+crypto.createHash('sha256').update(parts.map(v=>String(v??'')).join('|')).digest('hex').slice(0,24);}
function clamp(v,min=0,max=1){v=Number(v);return Number.isFinite(v)?Math.max(min,Math.min(max,v)):min;}
function normalizeEmail(v){const s=String(v||'').trim().toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:null;}
function normalizePhone(v,defaultCountry='1'){
  let s=String(v||'').trim();if(!s)return null;
  const hadPlus=s.startsWith('+');s=s.replace(/\D/g,'');
  if(!s)return null;
  if(s.length===10&&defaultCountry)s=defaultCountry+s;
  if(s.length<10||s.length>15)return null;
  return '+'+s;
}
function normalizeIdentifier(type,value){
  type=String(type||'').toLowerCase();
  if(type==='email')return normalizeEmail(value);
  if(type==='phone')return normalizePhone(value);
  const s=String(value||'').trim().toLowerCase();return s||null;
}
function truthClass(v='UNKNOWN'){v=String(v).toUpperCase();return TRUTH_CLASSES.has(v)?v:'UNKNOWN';}
function entityType(v='UNKNOWN_ENTITY'){v=String(v).toUpperCase().replace(/\s+/g,'_');return ENTITY_TYPES.has(v)?v:'UNKNOWN_ENTITY';}
function identityBand(score){score=clamp(score);if(score>=IDENTITY_STATES.AUTO_MERGE)return'AUTO_MERGE';if(score>=IDENTITY_STATES.LIKELY_MATCH)return'LIKELY_MATCH';if(score>=IDENTITY_STATES.POSSIBLE_MATCH)return'POSSIBLE_MATCH';return'KEEP_SEPARATE';}
function scoreIdentity(a={},b={}){
  const ai=(a.identifiers||[]).map(x=>[String(x.type||'').toLowerCase(),normalizeIdentifier(x.type,x.value),Boolean(x.verified)]);
  const bi=(b.identifiers||[]).map(x=>[String(x.type||'').toLowerCase(),normalizeIdentifier(x.type,x.value),Boolean(x.verified)]);
  let score=0,reasons=[];
  for(const [at,av,aver] of ai){if(!av)continue;for(const [bt,bv,bver] of bi){if(at===bt&&av===bv){const s=(aver||bver)?.99:.96;score=Math.max(score,s);reasons.push(at+'_match');}}}
  const an=String(a.name||'').trim().toLowerCase(),bn=String(b.name||'').trim().toLowerCase();
  if(an&&bn&&an===bn){score=Math.max(score,.68);reasons.push('name_match');}
  const ao=String(a.organization||'').trim().toLowerCase(),bo=String(b.organization||'').trim().toLowerCase();
  if(ao&&bo&&ao===bo){score=Math.min(1,score+.10);reasons.push('organization_match');}
  if(a.contactBookMatch||b.contactBookMatch){score=Math.max(score,.97);reasons.push('explicit_contact_association');}
  if(a.userConfirmed||b.userConfirmed){score=1;reasons.push('user_confirmed');}
  return{score:clamp(score),band:identityBand(score),reasons:[...new Set(reasons)]};
}

async function init(){
  if(!ready)ready=(async()=>{await knowledge.init();await db().query(`
CREATE TABLE IF NOT EXISTS jarvis_evidence(
 id text PRIMARY KEY, source_type text NOT NULL, source_record_id text NOT NULL, evidence_type text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(), source_timestamp timestamptz, raw_reference text,
 participants jsonb NOT NULL DEFAULT '[]'::jsonb, content jsonb NOT NULL DEFAULT '{}'::jsonb,
 ingestion_method text NOT NULL, confidence real NOT NULL DEFAULT 1,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_type,source_record_id));
CREATE INDEX IF NOT EXISTS jarvis_evidence_source_idx ON jarvis_evidence(source_type,observed_at DESC);

CREATE TABLE IF NOT EXISTS jarvis_entity_identifiers(
 id text PRIMARY KEY, entity_id text NOT NULL REFERENCES jarvis_entities(id) ON DELETE CASCADE,
 identifier_type text NOT NULL, identifier_value text NOT NULL, normalized_value text NOT NULL,
 verified boolean NOT NULL DEFAULT false, source_evidence_id text REFERENCES jarvis_evidence(id) ON DELETE SET NULL,
 first_seen_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(identifier_type,normalized_value));
CREATE INDEX IF NOT EXISTS jarvis_identifier_entity_idx ON jarvis_entity_identifiers(entity_id);

CREATE TABLE IF NOT EXISTS jarvis_entity_aliases(
 id text PRIMARY KEY, entity_id text NOT NULL REFERENCES jarvis_entities(id) ON DELETE CASCADE,
 alias text NOT NULL, normalized_alias text NOT NULL, source_evidence_id text REFERENCES jarvis_evidence(id) ON DELETE SET NULL,
 confidence real NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(entity_id,normalized_alias));

CREATE TABLE IF NOT EXISTS jarvis_claims(
 id text PRIMARY KEY, subject_entity_id text NOT NULL REFERENCES jarvis_entities(id) ON DELETE CASCADE,
 claim_key text NOT NULL, claim_value jsonb NOT NULL, truth_class text NOT NULL, confidence real NOT NULL DEFAULT 0,
 first_observed_at timestamptz NOT NULL DEFAULT now(), last_observed_at timestamptz NOT NULL DEFAULT now(),
 last_verified_at timestamptz, valid_from timestamptz, valid_to timestamptz,
 supersedes_claim_id text REFERENCES jarvis_claims(id) ON DELETE SET NULL,
 contradicted_by_claim_id text REFERENCES jarvis_claims(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'CURRENT', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS jarvis_claim_subject_idx ON jarvis_claims(subject_entity_id,claim_key,status,last_observed_at DESC);

CREATE TABLE IF NOT EXISTS jarvis_claim_evidence(
 claim_id text NOT NULL REFERENCES jarvis_claims(id) ON DELETE CASCADE,
 evidence_id text NOT NULL REFERENCES jarvis_evidence(id) ON DELETE RESTRICT,
 contribution real NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(claim_id,evidence_id));

CREATE TABLE IF NOT EXISTS jarvis_identity_candidates(
 id text PRIMARY KEY, left_entity_id text NOT NULL REFERENCES jarvis_entities(id) ON DELETE CASCADE,
 right_entity_id text NOT NULL REFERENCES jarvis_entities(id) ON DELETE CASCADE,
 score real NOT NULL, decision_band text NOT NULL, reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
 status text NOT NULL DEFAULT 'PENDING', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(left_entity_id,right_entity_id));

CREATE TABLE IF NOT EXISTS jarvis_identity_decisions(
 id text PRIMARY KEY, candidate_id text REFERENCES jarvis_identity_candidates(id) ON DELETE SET NULL,
 decision text NOT NULL, decided_by text NOT NULL, rationale text,
 created_at timestamptz NOT NULL DEFAULT now());
`);
  return true;})();return ready;
}

async function ingestEvidence(input={}){
  await init();
  const sourceType=String(input.source||input.sourceType||'unknown').trim().toLowerCase();
  const sourceRecordId=String(input.sourceRecordId||input.source_record_id||'').trim();
  const evidenceType=String(input.type||input.evidenceType||'observation').trim().toLowerCase();
  const ingestionMethod=String(input.ingestionMethod||input.ingestion_method||'connector').trim().toLowerCase();
  if(!sourceType||!sourceRecordId)throw Object.assign(new Error('evidence_source_required'),{status:400});
  const evidenceId=stableId('ev',sourceType,sourceRecordId);
  await db().query(`INSERT INTO jarvis_evidence(
    id,source_type,source_record_id,evidence_type,observed_at,source_timestamp,raw_reference,participants,content,ingestion_method,confidence,metadata)
    VALUES($1,$2,$3,$4,now(),$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb)
    ON CONFLICT(source_type,source_record_id) DO NOTHING`,[
      evidenceId,sourceType,sourceRecordId,evidenceType,input.sourceTimestamp||input.source_timestamp||null,input.rawReference||input.raw_reference||null,
      JSON.stringify(input.participants||[]),JSON.stringify(input.content??{}),ingestionMethod,clamp(input.confidence??1),JSON.stringify(input.metadata||{})
    ]);
  const r=await db().query('SELECT * FROM jarvis_evidence WHERE source_type=$1 AND source_record_id=$2',[sourceType,sourceRecordId]);
  return r.rows[0];
}

async function evidenceById(id){
  await init();const r=await db().query('SELECT * FROM jarvis_evidence WHERE id=$1',[id]);return r.rows[0]||null;
}

async function createEntity(input={}){
  await init();const type=entityType(input.type),name=String(input.name||input.preferredName||'Unknown').trim()||'Unknown';
  const canonical=input.canonical||stableId('entity-key',type,name,Date.now(),Math.random());
  const e=await knowledge.upsertEntity(type.toLowerCase(),name,{canonical,entityClass:type,preferredName:input.preferredName||name,importanceTier:input.importanceTier||'UNKNOWN'},clamp(input.confidence??1));
  for(const alias of input.aliases||[])await addAlias(e.id,alias,input.evidenceId,input.confidence??1);
  for(const ident of input.identifiers||[])await addIdentifier(e.id,ident.type,ident.value,{verified:ident.verified,evidenceId:ident.evidenceId||input.evidenceId});
  return e;
}

async function addAlias(entityId,alias,evidenceId=null,confidence=1){
  await init();alias=String(alias||'').trim();if(!alias)return null;const norm=alias.toLowerCase().replace(/\s+/g,' ');
  const id=stableId('alias',entityId,norm);
  await db().query(`INSERT INTO jarvis_entity_aliases(id,entity_id,alias,normalized_alias,source_evidence_id,confidence)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(entity_id,normalized_alias) DO UPDATE SET confidence=GREATEST(jarvis_entity_aliases.confidence,excluded.confidence)`,
    [id,entityId,alias,norm,evidenceId,clamp(confidence)]);
  return id;
}

async function addIdentifier(entityId,type,value,{verified=false,evidenceId=null}={}){
  await init();type=String(type||'').toLowerCase();const normalized=normalizeIdentifier(type,value);if(!normalized)throw Object.assign(new Error('identifier_invalid'),{status:400});
  const existing=await db().query('SELECT * FROM jarvis_entity_identifiers WHERE identifier_type=$1 AND normalized_value=$2',[type,normalized]);
  if(existing.rows[0]&&existing.rows[0].entity_id!==entityId)return{conflict:true,existing:existing.rows[0]};
  const id=stableId('ident',type,normalized);
  await db().query(`INSERT INTO jarvis_entity_identifiers(id,entity_id,identifier_type,identifier_value,normalized_value,verified,source_evidence_id)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(identifier_type,normalized_value)
    DO UPDATE SET verified=jarvis_entity_identifiers.verified OR excluded.verified,last_seen_at=now()`,
    [id,entityId,type,String(value),normalized,Boolean(verified),evidenceId]);
  return{conflict:false,id,normalized};
}

async function resolveIdentifier(type,value){
  await init();const normalized=normalizeIdentifier(type,value);if(!normalized)return null;
  const r=await db().query(`SELECT e.*,i.identifier_type,i.normalized_value,i.verified FROM jarvis_entity_identifiers i
    JOIN jarvis_entities e ON e.id=i.entity_id WHERE i.identifier_type=$1 AND i.normalized_value=$2`,[String(type).toLowerCase(),normalized]);
  return r.rows[0]||null;
}

async function entityIdentityProfile(entityId){
  await init();
  const [e,i,a]=await Promise.all([
    db().query('SELECT * FROM jarvis_entities WHERE id=$1',[entityId]),
    db().query('SELECT identifier_type type,normalized_value value,verified FROM jarvis_entity_identifiers WHERE entity_id=$1',[entityId]),
    db().query('SELECT alias,confidence FROM jarvis_entity_aliases WHERE entity_id=$1',[entityId])
  ]);
  if(!e.rows[0])return null;return{...e.rows[0],identifiers:i.rows,aliases:a.rows};
}

async function proposeIdentity(leftEntityId,rightEntityId){
  await init();if(leftEntityId===rightEntityId)throw Object.assign(new Error('identity_entities_must_differ'),{status:400});
  const [a,b]=await Promise.all([entityIdentityProfile(leftEntityId),entityIdentityProfile(rightEntityId)]);
  if(!a||!b)throw Object.assign(new Error('identity_entity_not_found'),{status:404});
  const result=scoreIdentity({name:a.name,identifiers:a.identifiers,organization:a.data?.organization,userConfirmed:false},{name:b.name,identifiers:b.identifiers,organization:b.data?.organization,userConfirmed:false});
  const [left,right]=[leftEntityId,rightEntityId].sort(),id=stableId('idc',left,right);
  await db().query(`INSERT INTO jarvis_identity_candidates(id,left_entity_id,right_entity_id,score,decision_band,reasons)
    VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(left_entity_id,right_entity_id)
    DO UPDATE SET score=excluded.score,decision_band=excluded.decision_band,reasons=excluded.reasons,updated_at=now()`,
    [id,left,right,result.score,result.band,JSON.stringify(result.reasons)]);
  return{id,leftEntityId:left,rightEntityId:right,...result};
}

async function addClaim(input={}){
  await init();const entityId=String(input.subjectEntityId||'');if(!entityId||!input.claimKey)throw Object.assign(new Error('claim_subject_and_key_required'),{status:400});
  const tc=truthClass(input.truthClass),confidence=clamp(input.confidence??(tc==='USER_CONFIRMED'?1:0));
  const claimId=input.id||stableId('claim',entityId,input.claimKey,JSON.stringify(input.value),Date.now(),Math.random());
  await db().query(`INSERT INTO jarvis_claims(id,subject_entity_id,claim_key,claim_value,truth_class,confidence,last_verified_at,valid_from,valid_to,supersedes_claim_id)
    VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10)`,[
      claimId,entityId,String(input.claimKey),JSON.stringify(input.value),tc,confidence,
      input.lastVerifiedAt||((tc==='USER_CONFIRMED'||tc==='SOURCE_VERIFIED')?new Date().toISOString():null),
      input.validFrom||null,input.validTo||null,input.supersedesClaimId||null
    ]);
  for(const evidenceId of input.evidenceIds||[])await db().query('INSERT INTO jarvis_claim_evidence(claim_id,evidence_id,contribution) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[claimId,evidenceId,1]);
  if(input.supersedesClaimId)await db().query(`UPDATE jarvis_claims SET status='SUPERSEDED',valid_to=COALESCE(valid_to,now()),updated_at=now() WHERE id=$1`,[input.supersedesClaimId]);
  return claimById(claimId);
}

async function correctClaim(input={}){
  await init();const old=await claimById(input.claimId);if(!old)throw Object.assign(new Error('claim_not_found'),{status:404});
  return addClaim({subjectEntityId:old.subject_entity_id,claimKey:old.claim_key,value:input.value,truthClass:'USER_CONFIRMED',confidence:1,evidenceIds:input.evidenceIds||[],supersedesClaimId:old.id,lastVerifiedAt:new Date().toISOString()});
}

async function claimById(id){
  await init();const r=await db().query(`SELECT c.*,COALESCE(json_agg(json_build_object('id',e.id,'source',e.source_type,'type',e.evidence_type,'observedAt',e.observed_at)) FILTER(WHERE e.id IS NOT NULL),'[]') evidence
  FROM jarvis_claims c LEFT JOIN jarvis_claim_evidence ce ON ce.claim_id=c.id LEFT JOIN jarvis_evidence e ON e.id=ce.evidence_id
  WHERE c.id=$1 GROUP BY c.id`,[id]);return r.rows[0]||null;
}

async function truthForEntity(entityId){
  await init();const r=await db().query(`SELECT c.*,COALESCE(json_agg(json_build_object('id',e.id,'source',e.source_type,'type',e.evidence_type,'observedAt',e.observed_at)) FILTER(WHERE e.id IS NOT NULL),'[]') evidence
  FROM jarvis_claims c LEFT JOIN jarvis_claim_evidence ce ON ce.claim_id=c.id LEFT JOIN jarvis_evidence e ON e.id=ce.evidence_id
  WHERE c.subject_entity_id=$1 GROUP BY c.id ORDER BY (c.status='CURRENT') DESC,c.last_observed_at DESC`,[entityId]);return r.rows;
}

async function resolveIdentityCandidate(candidateId,decision,actor='user',rationale=null){
  await init();decision=String(decision||'').toUpperCase();if(!['MERGE','KEEP_SEPARATE'].includes(decision))throw Object.assign(new Error('identity_decision_invalid'),{status:400});
  const c=await db().query('SELECT * FROM jarvis_identity_candidates WHERE id=$1',[candidateId]);if(!c.rows[0])throw Object.assign(new Error('identity_candidate_not_found'),{status:404});
  const did=stableId('idd',candidateId,decision,Date.now());
  await db().query('INSERT INTO jarvis_identity_decisions(id,candidate_id,decision,decided_by,rationale) VALUES($1,$2,$3,$4,$5)',[did,candidateId,decision,actor,rationale]);
  await db().query('UPDATE jarvis_identity_candidates SET status=$2,updated_at=now() WHERE id=$1',[candidateId,decision]);
  return{id:did,candidateId,decision,actor};
}

async function phaseOneStatus(){
  await init();const names=['jarvis_evidence','jarvis_entity_identifiers','jarvis_entity_aliases','jarvis_claims','jarvis_claim_evidence','jarvis_identity_candidates','jarvis_identity_decisions'];
  const counts={};for(const n of names){const r=await db().query('SELECT count(*)::int count FROM '+n);counts[n]=r.rows[0]?.count||0;}
  return{status:'READY',schemaVersion:'brain-phase-1',truthClasses:[...TRUTH_CLASSES],identityThresholds:IDENTITY_STATES,counts};
}

module.exports={init,ingestEvidence,evidenceById,createEntity,addAlias,addIdentifier,resolveIdentifier,entityIdentityProfile,proposeIdentity,addClaim,correctClaim,claimById,truthForEntity,resolveIdentityCandidate,phaseOneStatus,normalizeEmail,normalizePhone,normalizeIdentifier,truthClass,entityType,identityBand,scoreIdentity};
