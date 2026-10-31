const heartbeat=require('../server/heartbeat-engine');
const worlds=require('../server/world-refresh');
(async()=>{try{const world=await worlds.refresh();const result=await heartbeat.run(process.env.JARVIS_HEARTBEAT_TRIGGER||'render_cron');console.log(JSON.stringify({...result,world}));process.exit(0)}catch(e){console.error('heartbeat failed',e);process.exit(1)}})();
