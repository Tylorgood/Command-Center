const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const fallbackState = {
  system:{mode:'PERSONAL / BUILD', integrations:[]}, now:{primary_focus:'JARVIS V3',detail:'Life in motion.',life_commit:'LIFE-BOOT',next_commitment_time:'—'}, metrics:[],attention:[],active:[],calendar:[],missions:[],events:[]
};

async function loadState(){
  try{
    const r=await fetch('./state.json',{cache:'no-store'});
    if(!r.ok) throw new Error('state');
    return await r.json();
  }catch(e){ return fallbackState; }
}

function safeText(el, value){ if(el) el.textContent = value ?? '—'; }
function escapeHTML(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function startClock(){
  const tick=()=>{
    const d=new Date();
    safeText($('#clock'), d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}));
    safeText($('#dateLabel'), d.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric',year:'numeric'}));
    safeText($('#dayLabel'), d.toLocaleDateString([], {weekday:'long'}));
    const h=d.getHours();
    const part=h<12?'morning':h<17?'afternoon':'evening';
    safeText($('#greeting'), `Good ${part}, Tylor.`);
    updateNowMarker(d);
  };
  tick(); setInterval(tick,1000);
}

function renderBus(state){
  $('#systemBus').innerHTML=(state.system?.integrations||[]).map(x=>`<span class="bus-node ${escapeHTML(x.state)}">${escapeHTML(x.name)}</span>`).join('');
}

function renderMetrics(state){
  $('#metricGrid').innerHTML=(state.metrics||[]).map(m=>`<article class="metric"><div class="metric-label">${escapeHTML(m.label)}</div><div class="metric-value" data-count="${Number(m.value)||0}">0</div></article>`).join('');
  $$('.metric-value').forEach(el=>animateNumber(el,Number(el.dataset.count)||0));
}
function animateNumber(el,target){
  const start=performance.now(),dur=650;
  const step=t=>{const p=Math.min(1,(t-start)/dur);el.textContent=Math.round(target*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)};
  requestAnimationFrame(step);
}

function renderAttention(state){
  const list=state.attention||[]; safeText($('#attentionCount'),list.length);
  $('#attentionList').innerHTML=list.length?list.map((x,i)=>`<div class="stack-item"><div class="stack-title"><span>${escapeHTML(x.title)}</span><span class="stack-action">${escapeHTML(x.action||'REVIEW')}</span></div><div class="stack-meta">${escapeHTML(x.meta)}</div></div>`).join(''):`<div class="stack-item"><div class="stack-title"><span>Nothing needs you right now.</span></div><div class="stack-meta">JARVIS is holding the background state.</div></div>`;
}

function renderActive(state){
  const list=state.active||[]; safeText($('#activeCount'),`${list.length} ACTIVE`);
  $('#activeList').innerHTML=list.map(x=>`<div class="stack-item"><div class="stack-title"><span>${escapeHTML(x.title)}</span><span class="stack-action">${escapeHTML(x.state||'ACTIVE')}</span></div><div class="stack-meta">${escapeHTML(x.meta)}</div><div class="process-line" aria-hidden="true"><i></i></div></div>`).join('');
}

function hourPct(hour,minute=0){const start=6,end=24;return Math.max(0,Math.min(100,((hour+minute/60-start)/(end-start))*100));}
function updateNowMarker(d=new Date()){
  const marker=$('.rail-now');if(marker)marker.style.left=`${hourPct(d.getHours(),d.getMinutes())}%`;
}
function renderTimeline(state){
  const rail=$('#dayRail');
  const ticks=[6,9,12,15,18,21,24].map(h=>`<span class="rail-tick" style="left:${hourPct(h)}%">${h===24?'12A':h>12?(h-12)+'P':h+'A'}</span>`).join('');
  const events=(state.calendar||[]).map(e=>{
    const d=new Date(e.start);const pct=Number.isFinite(d.getTime())?hourPct(d.getHours(),d.getMinutes()):50;
    return `<div class="rail-event" style="left:${pct}%"><b>${escapeHTML(e.title)}</b><small>${escapeHTML(e.time||'')}</small></div>`;
  }).join('');
  rail.innerHTML=`<div class="rail-line"></div>${ticks}<div class="rail-now"></div>${events || '<div class="rail-event" style="left:50%"><b>Open day state</b><small>Hard-time events will land here</small></div>'}`;
  updateNowMarker();
}

function renderMissions(state){
  $('#missionList').innerHTML=(state.missions||[]).map(m=>`<div class="mission-row" data-mission="${escapeHTML(m.id)}"><div class="mission-state"><span class="mission-name">${escapeHTML(m.name)}</span><span class="state-tag">${escapeHTML(m.state)}</span></div><div class="mission-summary">${escapeHTML(m.summary)}</div></div>`).join('');
  $$('.mission-row').forEach(row=>row.addEventListener('click',()=>openMission(state,row.dataset.mission)));
}
function openMission(state,id){
  const m=(state.missions||[]).find(x=>x.id===id);if(!m)return;
  $('#inspectorContent').innerHTML=`<div class="inspector-grid"><div><div class="panel-kicker">MISSION INSPECTOR</div><h2>${escapeHTML(m.name)}</h2><span class="state-tag">${escapeHTML(m.state)}</span><p>${escapeHTML(m.objective||m.summary)}</p></div><div><div class="panel-kicker">NEXT</div><ul class="inspect-list">${(m.next||[]).map(x=>`<li>${escapeHTML(x)}</li>`).join('')||'<li>No immediate action required.</li>'}</ul></div><div><div class="panel-kicker">RECENT</div><ul class="inspect-list">${(m.recent||[]).map(x=>`<li>${escapeHTML(x)}</li>`).join('')||'<li>No recent events.</li>'}</ul></div></div>`;
  $('#missionInspector').hidden=false;
}

function renderMemory(state){
  $('#memoryStream').innerHTML=(state.events||[]).map(e=>`<div class="memory-row"><div class="memory-time">${escapeHTML(e.time)}</div><div><div class="memory-title">${escapeHTML(e.title)}</div><div class="memory-meta">${escapeHTML(e.meta)}</div></div><div class="memory-hash">${escapeHTML(e.hash)}</div></div>`).join('');
}

function applyState(state){
  safeText($('#focusMode'),state.system?.mode);
  safeText($('#primaryFocus'),state.now?.primary_focus);
  safeText($('#focusDetail'),state.now?.detail);
  safeText($('#lifeCommit'),state.now?.life_commit);
  safeText($('#nextCommitmentTime'),state.now?.next_commitment_time);
  renderBus(state);renderMetrics(state);renderAttention(state);renderActive(state);renderTimeline(state);renderMissions(state);renderMemory(state);
}

$('#closeInspector').addEventListener('click',()=>$('#missionInspector').hidden=true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#missionInspector').hidden=true});

const state=await loadState();
applyState(state);
startClock();
