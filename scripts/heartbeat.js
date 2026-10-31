const heartbeat=require('../server/heartbeat-engine');
(async()=>{try{const result=await heartbeat.run(process.env.JARVIS_HEARTBEAT_TRIGGER||'render_cron');console.log(JSON.stringify(result));process.exit(0)}catch(e){console.error('heartbeat failed',e);process.exit(1)}})();
