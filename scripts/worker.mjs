// Separate process: continues settlement when no browser is open.
const endpoint=(process.env.CLOSECALL_INTERNAL_URL||'http://127.0.0.1:3011')+'/api/cron';
if(!process.env.CLOSECALL_CRON_SECRET)throw Error('Cron secret required');
let running=false;
async function tick(){if(running)return;running=true;try{const r=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOSECALL_CRON_SECRET},signal:AbortSignal.timeout(90000)});const j=await r.json();if(!r.ok)throw Error('Worker HTTP '+r.status);if(j.checked)console.log(JSON.stringify({at:new Date().toISOString(),...j}));}catch(e){console.error('Settlement worker:',e.message);}finally{running=false;}}
await tick();setInterval(tick,15000);
