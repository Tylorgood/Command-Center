const {Pool}=require('pg');
let pool=null,ready=null;
function db(){if(!process.env.DATABASE_URL)throw Object.assign(new Error('truth_database_unavailable'),{code:'SOURCE_NEEDED'});if(!pool)pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});return pool;}
async function init(){if(!ready)ready=db().query(`
CREATE TABLE IF NOT EXISTS jarvis_evidence(
 id text PRIMARY KEY,source_type text NOT NULL,source_record_id text NOT NULL,evidence_type text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),source_timestamp timestamptz,raw_reference text,
 participants jsonb NOT NULL DEFAULT '[]'::jsonb,payload jsonb NOT NULL DEFAULT '{}'::jsonb,content_hash text NOT NULL,
 ingestion_method text,source_confidence real NOT NULL DEFAULT 1,sensitivity_class text NOT NULL DEFAULT 'private',
 invalidated_at timestamptz,invalidation_reason text,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_type,source_record_id,evidence_type));
CREATE INDEX IF NOT EXISTS jarvis_evidence_source_idx ON jarvis_evidence(source_type,source_timestamp DESC);
CREATE INDEX IF NOT EXISTS jarvis_evidence_observed_idx ON jarvis_evidence(observed_at DESC);
CREATE TABLE IF NOT EXISTS jarvis_entity_identifiers(
 id text PRIMARY KEY,entity_id text NOT NULL REFERENCES jarvis_entities(id) ON DELETE CASCADE,
 identifier_type text NOT NULL,normalized_value text NOT NULL,raw_value text,verified boolean NOT NULL DEFAULT false,
 confidence real NOT NULL DEFAULT .5,source_evidence_id text REFERENCES jarvis_evidence(id) ON DELETE SET NULL,
 first_seen_at timestamptz NOT NULL DEFAULT now(),last_seen_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(identifier_type,normalized_value,entity_id));
CREATE INDEX IF NOT EXISTS jarvis_entity_identifiers_lookup_idx ON jarvis_entity_identifiers(identifier_type,normalized_value,verified DESC,confidence DESC);
CREATE TABLE IF NOT EXISTS jarvis_entity_aliases(
 id text PRIMARY KEY,entity_id text NOT NULL REFERENCES jarvis_entities(id) ON DELETE CASCADE,alias text NOT NULL,normalized_alias text NOT NULL,
 source_evidence_id text REFERENCES jarvis_evidence(id) ON DELETE SET NULL,confidence real NOT NULL DEFAULT .5,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(entity_id,normalized_alias));
CREATE TABLE IF NOT EXISTS jarvis_claims(
 id text PRIMARY KEY,subject_entity_id text NOT NULL REFERENCES jarvis_entities(id) ON DELETE CASCADE,predicate text NOT NULL,
 object_value jsonb NOT NULL,truth_class text NOT NULL,confidence real NOT NULL DEFAULT .5,status text NOT NULL DEFAULT 'CURRENT',
 valid_from timestamptz,valid_until timestamptz,first_observed_at timestamptz NOT NULL DEFAULT now(),last_observed_at timestamptz NOT NULL DEFAULT now(),last_verified_at timestamptz,
 supersedes_claim_id text REFERENCES jarvis_claims(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS jarvis_claims_subject_idx ON jarvis_claims(subject_entity_id,predicate,status,confidence DESC);
CREATE TABLE IF NOT EXISTS jarvis_claim_evidence(
 claim_id text NOT NULL REFERENCES jarvis_claims(id) ON DELETE CASCADE,evidence_id text NOT NULL REFERENCES jarvis_evidence(id) ON DELETE CASCADE,
 support_type text NOT NULL DEFAULT 'SUPPORTS',weight real NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(claim_id,evidence_id,support_type));
CREATE TABLE IF NOT EXISTS jarvis_identity_candidates(
 id text PRIMARY KEY,left_entity_id text NOT NULL REFERENCES jarvis_entities(id) ON DELETE CASCADE,right_entity_id text NOT NULL REFERENCES jarvis_entities(id) ON DELETE CASCADE,
 score real NOT NULL,status text NOT NULL,signals jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz,
 UNIQUE(left_entity_id,right_entity_id));
CREATE TABLE IF NOT EXISTS jarvis_identity_decisions(
 id text PRIMARY KEY,candidate_id text REFERENCES jarvis_identity_candidates(id) ON DELETE SET NULL,decision text NOT NULL,decided_by text NOT NULL,rationale text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS jarvis_conversations(
 id text PRIMARY KEY,channel text NOT NULL,source_conversation_id text NOT NULL,title text,status text NOT NULL DEFAULT 'ACTIVE',participant_entity_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
 started_at timestamptz,last_activity_at timestamptz,topic_summary text,data jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(channel,source_conversation_id));
CREATE TABLE IF NOT EXISTS jarvis_messages(
 id text PRIMARY KEY,conversation_id text NOT NULL REFERENCES jarvis_conversations(id) ON DELETE CASCADE,evidence_id text NOT NULL UNIQUE REFERENCES jarvis_evidence(id) ON DELETE CASCADE,
 sender_entity_id text REFERENCES jarvis_entities(id) ON DELETE SET NULL,direction text NOT NULL,message_at timestamptz,content text NOT NULL,intents jsonb NOT NULL DEFAULT '[]'::jsonb,state jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS jarvis_context_episodes(
 id text PRIMARY KEY,conversation_id text REFERENCES jarvis_conversations(id) ON DELETE CASCADE,episode_type text NOT NULL,title text,summary text,status text NOT NULL DEFAULT 'OPEN',
 starts_at timestamptz,ends_at timestamptz,entity_ids jsonb NOT NULL DEFAULT '[]'::jsonb,evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,confidence real NOT NULL DEFAULT .5,data jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS jarvis_truth_recommendations(
 id text PRIMARY KEY,situation_id text,subject_entity_id text REFERENCES jarvis_entities(id) ON DELETE SET NULL,recommendation_type text NOT NULL,
 observation text,relevant_context jsonb NOT NULL DEFAULT '[]'::jsonb,assessment text,recommendation text,confidence real NOT NULL DEFAULT .5,evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,status text NOT NULL DEFAULT 'PREPARED',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS jarvis_truth_outcomes(
 id text PRIMARY KEY,recommendation_id text REFERENCES jarvis_truth_recommendations(id) ON DELETE SET NULL,decision text,action_taken text,result text,user_feedback text,success boolean,time_to_action_seconds integer,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS jarvis_learning_events(
 id text PRIMARY KEY,learning_type text NOT NULL,subject_key text,old_value jsonb,new_value jsonb,evidence jsonb NOT NULL DEFAULT '{}'::jsonb,authority_scope text NOT NULL DEFAULT 'RANKING_ONLY',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS jarvis_black_box_events(
 id text PRIMARY KEY,event_type text NOT NULL,observation text,relevant_context jsonb NOT NULL DEFAULT '[]'::jsonb,assessment text,recommendation text,confidence real NOT NULL DEFAULT .5,evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,decision_id text,outcome_id text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS jarvis_truth_jobs(
 id text PRIMARY KEY,job_type text NOT NULL,payload jsonb NOT NULL DEFAULT '{}'::jsonb,status text NOT NULL DEFAULT 'PENDING',priority integer NOT NULL DEFAULT 50,attempts integer NOT NULL DEFAULT 0,run_after timestamptz NOT NULL DEFAULT now(),locked_at timestamptz,started_at timestamptz,finished_at timestamptz,error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS jarvis_library_migration_snapshots(
 id text PRIMARY KEY,label text NOT NULL,summary jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS jarvis_identity_candidates_status_idx ON jarvis_identity_candidates(status,score DESC);
CREATE INDEX IF NOT EXISTS jarvis_messages_conversation_idx ON jarvis_messages(conversation_id,message_at DESC);
CREATE INDEX IF NOT EXISTS jarvis_context_episodes_status_idx ON jarvis_context_episodes(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS jarvis_black_box_created_idx ON jarvis_black_box_events(created_at DESC);
CREATE INDEX IF NOT EXISTS jarvis_truth_jobs_queue_idx ON jarvis_truth_jobs(status,priority DESC,run_after);
`);return ready;}
module.exports={db,init};
