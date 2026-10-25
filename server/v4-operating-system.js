'use strict';

const { load, save, id, iso } = require('./store');

const OPERATING_CONTRACT = Object.freeze({
  version: '4.0-field-test',
  loop: ['OBSERVE','UNDERSTAND','DISCOVER','PREPARE','RANK','ASK','EXECUTE','VERIFY','REMEMBER'],
  principle: 'The unit of JARVIS is a prepared decision, not an alert.',
  boundaries: {
    personal_messages: 'OBSERVE_ONLY',
    professional_messages: 'PREPARE_ACTION_REQUIRES_APPROVAL',
    money: 'EXPLICIT_APPROVAL',
    commitments: 'EXPLICIT_APPROVAL',
    private_data_exposure: 'EXPLICIT_APPROVAL',
    authority_changes: 'EXPLICIT_APPROVAL'
  },
  foundationalRulesMaySelfModify: false
});

function ensureV4(state) {
  state.v4 ||= {};
  state.v4.contract ||= OPERATING_CONTRACT;
  state.v4.blackBox ||= [];
  state.v4.intentions ||= [];
  state.v4.feedback ||= [];
  state.v4.dailyPlans ||= [];
  state.v4.policyVersion ||= '4.0.0';
  state.v4.fieldTest ||= { status: 'ACTIVE', startedAt: iso(), ohYeahCount: 0, suggestionCount: 0 };
  return state;
}

function blackBoxEntry(input={}) {
  return {
    id: id('bb'), timestamp: iso(), kind: input.kind || 'reasoning_cycle',
    observed: input.observed || [], context: input.context || [],
    reasoning: input.reasoning || null, recommendation: input.recommendation || null,
    prepared: input.prepared || [], approval: input.approval || null,
    action: input.action || null, verification: input.verification || null,
    outcome: input.outcome || null, learning: input.learning || null,
    policyVersion: input.policyVersion || '4.0.0', actor: input.actor || 'jarvis'
  };
}

async function recordBlackBox(input) {
  const state = ensureV4(await load());
  const entry = blackBoxEntry(input);
  state.v4.blackBox.unshift(entry);
  state.v4.blackBox = state.v4.blackBox.slice(0, 2000);
  await save(state);
  return entry;
}

function todayKey(timezone='America/Detroit') {
  return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}

function freeWindows(calendar=[], timezone='America/Detroit') {
  const now = Date.now();
  const future = calendar.filter(e => Date.parse(e.start) > now).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  const next = future[0] || null;
  return { nextCommitment: next, minutesUntilNext: next ? Math.max(0, Math.floor((Date.parse(next.start)-now)/60000)) : null, openEnded: !next, timezone };
}

function rankCandidates(state) {
  const candidates = [];
  const pending = (state.decisions||[]).filter(d=>d.status==='pending');
  pending.forEach(d=>candidates.push({type:'decision',score:95,title:d.question,why:'A prepared decision is waiting for you.',action:'DECIDE',ref:d.id}));
  const jobs = (state.jobs||[]).filter(j=>['queued','running','waiting_for_user','waiting_external'].includes(j.status));
  jobs.slice(0,3).forEach(j=>candidates.push({type:'job',score:j.status==='waiting_for_user'?90:70,title:j.title,why:`JARVIS job is ${j.status.replaceAll('_',' ')}.`,action:j.status==='waiting_for_user'?'DECIDE':'OPEN',ref:j.id}));
  const career = (state.missions||[]).find(m=>m.id==='career');
  if(career) candidates.push({type:'mission',score:88,title:'Advance the next-job search',why:'Career transition is the active primary mission.',action:'PREPARE_NEXT_JOB_MOVE',ref:'career'});
  candidates.push({type:'mission',score:72,title:'Make one focused JARVIS improvement',why:'V4 Field Test is active; prefer one completed vertical slice over a long build rabbit hole.',action:'OPEN_JARVIS_BUILD',ref:'jarvis'});
  candidates.push({type:'life',score:62,title:'Protect body and personal time',why:'Gym, relationships and deliberate free time count as successful uses of the day.',action:'PROTECT_TIME',ref:'life'});
  return candidates.sort((a,b)=>b.score-a.score).slice(0,5);
}

function jarvisNow(state) {
  ensureV4(state);
  const ranked = rankCandidates(state);
  const top = ranked[0] || null;
  return {
    generatedAt: iso(), contractVersion: state.v4.contract.version,
    headline: top?.title || 'No urgent intervention needed.',
    whatHappened: top ? top.why : 'JARVIS found no item above the attention threshold.',
    whyItMatters: top ? 'This is currently the highest-ranked actionable use of attention.' : 'Silence is preferable to noise.',
    recommendation: top,
    preparedDecision: top ? { recommendation: top, alternatives: ranked.slice(1,4) } : null,
    rule: 'Nothing becomes prominent unless JARVIS can explain what happened, why it matters, what it recommends, and what can be done now.'
  };
}

function morningMeeting(state, input={}) {
  ensureV4(state);
  const ranked = rankCandidates(state);
  const energy = input.energy || 'normal';
  const push = input.push || 'balanced';
  const winConditions = ranked.slice(0,3).map((x,i)=>({priority:i+1,title:x.title,why:x.why}));
  return {
    date: todayKey(state.preferences?.timezone), energy, push,
    proposedDay: winConditions,
    winCondition: winConditions.length ? `Today counts as a win if we meaningfully complete these ${winConditions.length} priorities without sacrificing intentional personal time.` : 'Protect the day and respond only to meaningful changes.',
    freeWindow: freeWindows(state.calendar||[], state.preferences?.timezone),
    questions: ['Energy: low / normal / let’s go','Anything personal today JARVIS does not know?','Gym: yes / maybe / rest','Push: recovery / balanced / attack']
  };
}

function opportunityRadar(state, input={}) {
  ensureV4(state);
  const window = freeWindows(state.calendar||[], state.preferences?.timezone);
  const minutes = input.minutes ?? window.minutesUntilNext;
  return {
    generatedAt: iso(), availableMinutes: minutes, openEnded: window.openEnded,
    possibilities: rankCandidates(state).filter(x=>x.type!=='decision').slice(0,4),
    note: 'Possibilities stay warm until context makes them relevant; they do not become a giant backlog.'
  };
}

function dailyCheckout(state) {
  ensureV4(state);
  const recent = (state.events||[]).filter(e=>Date.now()-Date.parse(e.createdAt)<24*3600*1000).slice(0,12);
  return {
    inferred: recent.map(e=>({id:e.id,summary:e.summary,result:e.result,createdAt:e.createdAt})),
    quickCheck: { overall:['rough','off','okay','good','great'], energy:['low','medium','high'], planMatch:['nailed it','some changes','completely different'], pulledOffCourse:['people','work emergency','low energy','new idea','family/home','chose something better','nothing'] },
    prompt: 'Here is what I think happened. Correct me instead of reconstructing the day.'
  };
}

async function recordFeedback(input={}) {
  const state = ensureV4(await load());
  const feedback = {id:id('feedback'),createdAt:iso(),signal:input.signal||'unknown',target:input.target||null,note:input.note||null};
  state.v4.feedback.unshift(feedback);
  if(input.signal==='great_suggestion' || input.signal==='oh_yeah') state.v4.fieldTest.ohYeahCount++;
  if(input.target) state.v4.fieldTest.suggestionCount++;
  await save(state);
  return feedback;
}

function blackBoxView(state, limit=100) {
  ensureV4(state);
  return { contract: state.v4.contract, policyVersion: state.v4.policyVersion, fieldTest: state.v4.fieldTest, entries: state.v4.blackBox.slice(0,Math.min(500,Math.max(1,Number(limit)||100))) };
}

module.exports = { OPERATING_CONTRACT, ensureV4, recordBlackBox, jarvisNow, morningMeeting, opportunityRadar, dailyCheckout, recordFeedback, blackBoxView, rankCandidates };
